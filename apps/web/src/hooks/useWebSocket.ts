"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomState, WSMessage, WSMessageType } from "@nichestream/types";

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/^http/, "ws") ?? "ws://localhost:8787";

interface UseWebSocketOptions {
  videoId: string;
  userId?: string;
  username?: string;
  avatarUrl?: string | null;
  onMessage?: (msg: WSMessage) => void;
}

interface UseWebSocketReturn {
  roomState: RoomState | null;
  isConnected: boolean;
  sendMessage: (type: WSMessageType, payload: Record<string, unknown>) => void;
  disconnect: () => void;
}

/**
 * Hook that manages a WebSocket connection to the VideoRoom Durable Object.
 * Handles reconnection with exponential back-off on non-intentional close.
 */
export function useWebSocket({
  videoId,
  userId,
  username = "Guest",
  avatarUrl,
  onMessage,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalDisconnect = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const params = new URLSearchParams({
      username,
      ...(userId && { userId }),
      ...(avatarUrl && { avatarUrl }),
    });

    const ws = new WebSocket(`${WS_BASE_URL}/api/ws/${videoId}?${params.toString()}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;

        if (msg.type === "room_state") {
          setRoomState(msg.payload as unknown as RoomState);
        }

        onMessage?.(msg);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      if (!intentionalDisconnect.current) {
        // Exponential back-off: 1s, 2s, 4s, 8s, 16s, cap at 30s
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          30_000,
        );
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [videoId, userId, username, avatarUrl, onMessage]);

  useEffect(() => {
    intentionalDisconnect.current = false;
    connect();

    return () => {
      intentionalDisconnect.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback(
    (type: WSMessageType, payload: Record<string, unknown>) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({ type, payload, timestamp: new Date().toISOString() }),
      );
    },
    [],
  );

  const disconnect = useCallback(() => {
    intentionalDisconnect.current = true;
    wsRef.current?.close();
  }, []);

  return { roomState, isConnected, sendMessage, disconnect };
}
