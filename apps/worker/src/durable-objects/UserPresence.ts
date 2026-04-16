import type { DurableObjectState, WebSocket } from "@cloudflare/workers-types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import type { Env } from "../types";

interface PresenceEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  lastSeen: number;
}

/**
 * UserPresence Durable Object tracks online/offline status for a single user.
 * One instance per user, keyed by userId.
 */
export class UserPresence {
  private readonly state: DurableObjectState;
  private readonly env: Env;
  private sessions: Set<WebSocket> = new Set();
  private presenceData: PresenceEntry | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<PresenceEntry>("presence");
      if (stored) this.presenceData = stored;
    });
  }

  async fetch(request: Request): Promise<Response> {
    // WebSocket connection to track real-time presence
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const db = createDb(this.env);
      const auth = createAuth(db, this.env);
      const session = await auth.api.getSession({ headers: request.headers });

      if (!session?.user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const userId = session.user.id;
      const username = session.user.name ?? session.user.email ?? "Guest";
      const avatarUrl = session.user.image ?? null;

      const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      this.state.acceptWebSocket(server, [userId]);

      this.sessions.add(server);

      this.presenceData = {
        userId,
        username,
        avatarUrl,
        lastSeen: Date.now(),
      };
      await this.state.storage.put("presence", this.presenceData);

      return new Response(null, { status: 101, webSocket: client });
    }

    // GET presence data
    if (request.method === "GET") {
      return new Response(JSON.stringify(this.presenceData), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);

    if (this.presenceData) {
      this.presenceData.lastSeen = Date.now();
      await this.state.storage.put("presence", this.presenceData);
    }
  }
}
