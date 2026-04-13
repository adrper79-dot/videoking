import type { DurableObjectState, WebSocket } from "@cloudflare/workers-types";
import type { ChatMessage, Poll, WSMessage, WSMessageType } from "@nichestream/types";

interface Session {
  userId: string;
  username: string;
  avatarUrl: string | null;
  ws: WebSocket;
  lastMessageAt: number;
}

interface StoredChatMessage {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  content: string;
  type: "message" | "reaction" | "system";
  createdAt: string;
}

/**
 * VideoRoom Durable Object manages real-time interactions for a single video:
 * - WebSocket sessions with hibernation support
 * - Chat history (last 100 messages persisted in DO storage)
 * - Live polls with vote tallying
 * - Reaction counts
 * - Watch party sync (host controls playback state for all viewers)
 * - Per-user rate limiting (max 1 message/second)
 */
export class VideoRoom {
  private readonly state: DurableObjectState;
  private sessions: Map<string, Session> = new Map();
  private reactionCounts: Map<string, number> = new Map();
  private activePoll: (Poll & { votes: Record<string, number> }) | null = null;
  private chatHistory: StoredChatMessage[] = [];
  private watchPartyState: {
    isPlaying: boolean;
    currentTimeSeconds: number;
    updatedAt: number;
    hostUserId: string | null;
  } = {
    isPlaying: false,
    currentTimeSeconds: 0,
    updatedAt: Date.now(),
    hostUserId: null,
  };

  constructor(state: DurableObjectState) {
    this.state = state;
    // Restore persisted state on cold start
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<StoredChatMessage[]>("chatHistory");
      if (stored) this.chatHistory = stored;

      const poll = await this.state.storage.get<typeof this.activePoll>("activePoll");
      if (poll) this.activePoll = poll;

      const reactions = await this.state.storage.get<Record<string, number>>("reactionCounts");
      if (reactions) {
        this.reactionCounts = new Map(Object.entries(reactions));
      }
    });
  }

  /** Handle HTTP requests to this DO instance (WebSocket upgrade or REST). */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");

    if (upgradeHeader?.toLowerCase() === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    // REST-style internal calls (e.g. persist chat from API route)
    const url = new URL(request.url);
    if (url.pathname === "/internal/chat" && request.method === "POST") {
      return this.handleInternalChatPost(request);
    }

    return new Response("Not Found", { status: 404 });
  }

  /** Upgrade connection to WebSocket using the hibernation API. */
  private handleWebSocketUpgrade(request: Request): Response {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? "anonymous";
    const username = url.searchParams.get("username") ?? "Guest";
    const avatarUrl = url.searchParams.get("avatarUrl") ?? null;

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];

    // Tag the WebSocket so we can identify the session on wake-up
    this.state.acceptWebSocket(server, [userId]);

    const session: Session = {
      userId,
      username,
      avatarUrl,
      ws: server,
      lastMessageAt: 0,
    };
    this.sessions.set(userId, session);

    // Send current room state immediately after connect
    this.sendRoomState(server);

    // Broadcast user joined
    this.broadcast(
      {
        type: "user_presence",
        payload: {
          action: "join",
          userId,
          username,
          avatarUrl,
          connectedCount: this.sessions.size,
        },
        timestamp: new Date().toISOString(),
      },
      userId,
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Called by the Workers runtime when a WebSocket message arrives (hibernation). */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    const tags = this.state.getTags(ws);
    const userId = tags[0] ?? "anonymous";

    // Re-register session if it was evicted from the in-memory Map during hibernation
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        userId,
        username: "Guest",
        avatarUrl: null,
        ws,
        lastMessageAt: 0,
      });
    }

    let parsed: WSMessage;
    try {
      parsed = JSON.parse(message) as WSMessage;
    } catch {
      ws.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Invalid JSON" },
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    await this.handleMessage(userId, parsed);
  }

  /** Called by the Workers runtime when a WebSocket closes (hibernation). */
  async webSocketClose(ws: WebSocket): Promise<void> {
    const tags = this.state.getTags(ws);
    const userId = tags[0];
    if (!userId) return;

    const session = this.sessions.get(userId);
    this.sessions.delete(userId);

    if (session) {
      this.broadcast({
        type: "user_presence",
        payload: {
          action: "leave",
          userId,
          username: session.username,
          connectedCount: this.sessions.size,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /** Dispatch incoming WebSocket messages to the appropriate handler. */
  private async handleMessage(userId: string, msg: WSMessage): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;

    switch (msg.type as WSMessageType) {
      case "chat_message":
        await this.handleChatMessage(session, msg);
        break;
      case "reaction":
        this.handleReaction(session, msg);
        break;
      case "poll_create":
        await this.handlePollCreate(session, msg);
        break;
      case "poll_vote":
        await this.handlePollVote(session, msg);
        break;
      case "watch_party_sync":
        this.handleWatchPartySync(session, msg);
        break;
      default:
        break;
    }
  }

  /** Handle an incoming chat message with per-user rate limiting. */
  private async handleChatMessage(session: Session, msg: WSMessage): Promise<void> {
    const now = Date.now();
    if (now - session.lastMessageAt < 1000) {
      session.ws.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Rate limit: 1 message per second" },
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }
    session.lastMessageAt = now;

    const content = String(msg.payload["content"] ?? "").trim().slice(0, 500);
    if (!content) return;

    const chatMsg: StoredChatMessage = {
      id: crypto.randomUUID(),
      userId: session.userId,
      username: session.username,
      avatarUrl: session.avatarUrl,
      content,
      type: "message",
      createdAt: new Date().toISOString(),
    };

    // Append to history, keep last 100
    this.chatHistory.push(chatMsg);
    if (this.chatHistory.length > 100) {
      this.chatHistory = this.chatHistory.slice(-100);
    }
    await this.state.storage.put("chatHistory", this.chatHistory);

    this.broadcast({
      type: "chat_message",
      payload: chatMsg as unknown as Record<string, unknown>,
      timestamp: chatMsg.createdAt,
    });
  }

  /** Handle emoji reactions and broadcast updated counts. */
  private handleReaction(session: Session, msg: WSMessage): void {
    const emoji = String(msg.payload["emoji"] ?? "❤️").slice(0, 2);
    const current = this.reactionCounts.get(emoji) ?? 0;
    this.reactionCounts.set(emoji, current + 1);

    // Persist asynchronously without blocking the response
    void this.state.storage.put(
      "reactionCounts",
      Object.fromEntries(this.reactionCounts),
    );

    this.broadcast({
      type: "reaction",
      payload: {
        emoji,
        userId: session.userId,
        counts: Object.fromEntries(this.reactionCounts),
      },
      timestamp: new Date().toISOString(),
    });
  }

  /** Allow the creator to create a new poll (only one active poll at a time). */
  private async handlePollCreate(session: Session, msg: WSMessage): Promise<void> {
    if (this.activePoll) {
      session.ws.send(
        JSON.stringify({
          type: "error",
          payload: { message: "A poll is already active" },
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    const question = String(msg.payload["question"] ?? "").trim().slice(0, 200);
    const rawOptions = msg.payload["options"];
    if (
      !question ||
      !Array.isArray(rawOptions) ||
      rawOptions.length < 2 ||
      rawOptions.length > 6
    ) {
      return;
    }

    const options = (rawOptions as string[]).map((text, i) => ({
      id: String(i),
      text: String(text).trim().slice(0, 100),
    }));

    this.activePoll = {
      id: crypto.randomUUID(),
      videoId: "",
      creatorId: session.userId,
      question,
      options,
      status: "active",
      endsAt: null,
      createdAt: new Date().toISOString(),
      votes: {},
    };

    await this.state.storage.put("activePoll", this.activePoll);

    this.broadcast({
      type: "poll_create",
      payload: this.activePoll as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    });
  }

  /** Record a poll vote, prevent double-voting, broadcast updated totals. */
  private async handlePollVote(session: Session, msg: WSMessage): Promise<void> {
    if (!this.activePoll || this.activePoll.status !== "active") return;

    const optionId = String(msg.payload["optionId"] ?? "");
    const validOption = this.activePoll.options.some((o) => o.id === optionId);
    if (!validOption) return;

    // Prevent double voting (tracked by userId in the votes map)
    const hasVoted = Object.values(this.activePoll.votes).some(
      (_, key) => key === session.userId,
    );

    // Use a separate voter registry
    const voterKey = `poll_voter_${this.activePoll.id}_${session.userId}`;
    const alreadyVoted = await this.state.storage.get<boolean>(voterKey);
    if (alreadyVoted) return;

    await this.state.storage.put(voterKey, true);

    this.activePoll.votes[optionId] = (this.activePoll.votes[optionId] ?? 0) + 1;
    await this.state.storage.put("activePoll", this.activePoll);

    this.broadcast({
      type: "poll_update",
      payload: {
        pollId: this.activePoll.id,
        votes: this.activePoll.votes,
        totalVotes: Object.values(this.activePoll.votes).reduce((a, b) => a + b, 0),
      },
      timestamp: new Date().toISOString(),
    });

    void hasVoted; // suppress unused warning
  }

  /** Handle watch party sync events (play/pause/seek from host). */
  private handleWatchPartySync(session: Session, msg: WSMessage): void {
    // Only the host or room creator can sync
    if (
      this.watchPartyState.hostUserId &&
      this.watchPartyState.hostUserId !== session.userId
    ) {
      return;
    }

    if (!this.watchPartyState.hostUserId) {
      this.watchPartyState.hostUserId = session.userId;
    }

    const isPlaying = Boolean(msg.payload["isPlaying"]);
    const currentTimeSeconds = Number(msg.payload["currentTimeSeconds"] ?? 0);

    this.watchPartyState = {
      isPlaying,
      currentTimeSeconds,
      updatedAt: Date.now(),
      hostUserId: this.watchPartyState.hostUserId,
    };

    // Broadcast to all except host
    this.broadcast(
      {
        type: "watch_party_sync",
        payload: {
          isPlaying,
          currentTimeSeconds,
          hostUserId: session.userId,
        },
        timestamp: new Date().toISOString(),
      },
      session.userId,
    );
  }

  /** Send the full room state to a newly connected WebSocket. */
  private sendRoomState(ws: WebSocket): void {
    const stateMsg: WSMessage = {
      type: "room_state",
      payload: {
        connectedCount: this.sessions.size,
        recentMessages: this.chatHistory.slice(-50),
        activePoll: this.activePoll,
        reactionCounts: Object.fromEntries(this.reactionCounts),
        watchPartyState: this.watchPartyState,
      },
      timestamp: new Date().toISOString(),
    };
    ws.send(JSON.stringify(stateMsg));
  }

  /** Broadcast a message to all connected sessions, optionally excluding one. */
  private broadcast(msg: WSMessage, excludeUserId?: string): void {
    const payload = JSON.stringify(msg);
    for (const [userId, session] of this.sessions) {
      if (userId === excludeUserId) continue;
      try {
        session.ws.send(payload);
      } catch {
        // Remove dead connections
        this.sessions.delete(userId);
      }
    }
  }

  /** Internal endpoint called by the API route to store a persisted chat message. */
  private async handleInternalChatPost(request: Request): Promise<Response> {
    try {
      const msg = (await request.json()) as StoredChatMessage;
      this.chatHistory.push(msg);
      if (this.chatHistory.length > 100) {
        this.chatHistory = this.chatHistory.slice(-100);
      }
      await this.state.storage.put("chatHistory", this.chatHistory);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400 });
    }
  }
}
