/**
 * @module Logger
 * Structured logging for NicheStream Worker API.
 * 
 * Features:
 * - Contextual logging (request ID, user ID, operation)
 * - Severity levels (debug, info, warn, error, fatal)
 * - Performance metrics (duration, memory)
 * - JSON output for log aggregation (Axiom, DataDog, etc.)
 * - Request correlation IDs for distributed tracing
 * 
 * @example
 * ```typescript
 * const logger = createLogger(c, { operation: "subscribe" });
 * logger.info("subscription_started", { creatorId, tier: "vip" });
 * logger.error("payment_failed", { reason: err.message }, 500);
 * ```
 */

import type { Context } from "hono";

/**
 * Log severity levels (RFC 5424 syslog)
 */
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  FATAL = "FATAL",
}

/**
 * Structured log entry for aggregation services
 */
export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log level */
  level: string;
  /** Event name (e.g. "payment_processed", "auth_failed") */
  event: string;
  /** Unique request ID for correlation */
  requestId: string;
  /** Authenticated user ID (if available) */
  userId?: string;
  /** Operation name for grouping related logs */
  operation?: string;
  /** HTTP method and path */
  route?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Free-form metadata */
  metadata?: Record<string, any>;
  /** Error details */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  /** Source file and line (for debugging) */
  source?: string;
}

/**
 * Logger instance for a single request
 */
export interface Logger {
  /** Log debug-level message */
  debug(event: string, metadata?: Record<string, any>): void;
  /** Log info-level message */
  info(event: string, metadata?: Record<string, any>): void;
  /** Log warning-level message */
  warn(event: string, metadata?: Record<string, any>): void;
  /** Log error-level message */
  error(event: string, metadata?: Record<string, any>, statusCode?: number): void;
  /** Log fatal error and exit */
  fatal(event: string, metadata?: Record<string, any>, statusCode?: number): void;
  /** Get request ID for correlation */
  requestId(): string;
  /** Record operation duration */
  time<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T>;
}

/**
 * Create a logger instance bound to a Hono context
 * 
 * @param c - Hono context
 * @param options - Logger options
 * @returns Logger instance
 */
export function createLogger(
  c: Context,
  options: {
    /** Operation name for grouping (e.g. "subscribe", "chat_message") */
    operation?: string;
  } = {},
): Logger {
  // Extract request ID from headers or generate one
  const requestId =
    (c.req.header("x-request-id") as string) ||
    (c.req.header("cf-ray") as string) ||
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Extract user ID from context if available (set by auth middleware)
  const userId = (c.get("userId") as string | undefined) ?? undefined;

  const route = `${c.req.method} ${c.req.path}`;

  /**
   * Write structured log entry to console
   * Integrates with Cloudflare Workers logging and external aggregators
   */
  function write(level: LogLevel, event: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      requestId,
      userId,
      operation: options.operation,
      route,
      metadata: metadata ?? {},
    };

    // Output as JSON for log aggregation
    const logOutput = JSON.stringify(entry);

    // Route to appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logOutput);
        break;
      case LogLevel.INFO:
        console.log(logOutput);
        break;
      case LogLevel.WARN:
        console.warn(logOutput);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(logOutput);
        break;
    }
  }

  return {
    debug: (event, metadata) => write(LogLevel.DEBUG, event, metadata),
    info: (event, metadata) => write(LogLevel.INFO, event, metadata),
    warn: (event, metadata) => write(LogLevel.WARN, event, metadata),
    error: (event, metadata, statusCode) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.ERROR,
        event,
        requestId,
        userId,
        operation: options.operation,
        route,
        statusCode,
        metadata,
      };
      console.error(JSON.stringify(entry));
    },
    fatal: (event, metadata, statusCode) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.FATAL,
        event,
        requestId,
        userId,
        operation: options.operation,
        route,
        statusCode,
        metadata,
      };
      console.error(JSON.stringify(entry));
      // Worker will terminate, so this is a graceful shutdown
    },
    requestId: () => requestId,
    async time<T>(
      operationName: string,
      fn: () => Promise<T>,
    ): Promise<T> {
      const start = Date.now();
      try {
        const result = await fn();
        const durationMs = Date.now() - start;
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: LogLevel.DEBUG,
          event: `${operationName}_completed`,
          requestId,
          userId,
          operation: options.operation,
          route,
          durationMs,
        };
        console.debug(JSON.stringify(entry));
        return result;
      } catch (err) {
        const durationMs = Date.now() - start;
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: LogLevel.ERROR,
          event: `${operationName}_failed`,
          requestId,
          userId,
          operation: options.operation,
          route,
          durationMs,
          error: {
            message: err instanceof Error ? err.message : String(err),
            code: err instanceof Error && "code" in err ? String(err.code) : undefined,
            stack: err instanceof Error ? err.stack : undefined,
          },
        };
        console.error(JSON.stringify(entry));
        throw err;
      }
    },
  };
}

/**
 * Middleware to attach logger to context and set userId
 */
export function loggingMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const requestId =
      (c.req.header("x-request-id") as string) ||
      (c.req.header("cf-ray") as string) ||
      `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    c.set("requestId", requestId);
    c.set("logger", createLogger(c));

    const startTime = Date.now();
    await next();
    const durationMs = Date.now() - startTime;

    // Log request completion
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: c.res.status >= 400 ? LogLevel.WARN : LogLevel.INFO,
      event: "request_completed",
      requestId,
      route: `${c.req.method} ${c.req.path}`,
      statusCode: c.res.status,
      durationMs,
    };
    console.log(JSON.stringify(entry));
  };
}
