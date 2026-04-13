import type { DurableObjectState, WebSocket } from "@cloudflare/workers-types";

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
  private sessions: Set<WebSocket> = new Set();
  private presenceData: PresenceEntry | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<PresenceEntry>("presence");
      if (stored) this.presenceData = stored;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket connection to track real-time presence
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const userId = url.searchParams.get("userId") ?? "anonymous";
      const username = url.searchParams.get("username") ?? "Guest";
      const avatarUrl = url.searchParams.get("avatarUrl") ?? null;

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
