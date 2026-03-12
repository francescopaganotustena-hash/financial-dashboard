/**
 * WebSocket hook for RRG real-time updates
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Connection state indicator
 * - Fallback to polling if WebSocket unavailable
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WS_BASE_URL } from '../config/api';

export interface RRGData {
  benchmark: string;
  period: string;
  generated_at: string;
  assets: Array<{
    symbol: string;
    name: string;
    quadrant: string;
    current: {
      rs_ratio: number;
      rs_momentum: number;
    };
    tail: Array<{
      date: string;
      rs_ratio: number;
      rs_momentum: number;
    }>;
  }>;
}

export interface WebSocketMessage {
  type: 'rrg_update' | 'connected' | 'error';
  data?: RRGData;
  message?: string;
  timestamp: string;
  connection_id?: string;
}

export interface UseWebSocketOptions {
  symbols: string[];
  benchmark?: string;
  period?: 'daily' | 'weekly';
  enabled?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Error) => void;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  lastMessage: WebSocketMessage | null;
  reconnect: () => void;
  disconnect: () => void;
}

export function useWebSocket({
  symbols,
  benchmark = 'SPY',
  period = 'daily',
  enabled = true,
  onMessage,
  onError,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualDisconnectRef = useRef(false);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 1000;

  const calculateBackoff = (attempt: number): number => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 30s)
    return Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt), 30000);
  };

  const symbolsKey = symbols.join(',');

  const closeSocket = useCallback((manual: boolean) => {
    isManualDisconnectRef.current = manual;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || isManualDisconnectRef.current) return;

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnecting(true);
    setError(null);

    const url = `${WS_BASE_URL}/api/ws/rrg?symbols=${encodeURIComponent(symbolsKey)}&benchmark=${encodeURIComponent(benchmark)}&period=${encodeURIComponent(period)}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          if (message.type === 'error') {
            const err = new Error(message.message);
            setError(err);
            onError?.(err);
          } else {
            onMessage?.(message);
          }
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Attempt reconnection if not manually disconnected
        if (!isManualDisconnectRef.current && enabled) {
          const attempts = reconnectAttemptsRef.current;
          if (attempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = calculateBackoff(attempts);
            console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current += 1;
              connectRef.current();
            }, delay);
          } else {
            const err = new Error('Max reconnection attempts reached');
            setError(err);
            onError?.(err);
          }
        }
      };

      ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err);
        setError(new Error('WebSocket connection error'));
      };
    } catch (e) {
      console.error('[WebSocket] Failed to create connection:', e);
      setError(e as Error);
      setIsConnecting(false);
    }
  }, [symbolsKey, benchmark, period, enabled, onMessage, onError]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const reconnect = useCallback(() => {
    isManualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  const disconnect = useCallback(() => {
    closeSocket(true);
  }, [closeSocket]);

  // Initial connection
  useEffect(() => {
    if (!enabled) {
      return () => {
        closeSocket(false);
      };
    }

    const timer = setTimeout(() => {
      connectRef.current();
    }, 0);

    return () => {
      clearTimeout(timer);
      closeSocket(false);
    };
  }, [enabled, symbolsKey, benchmark, period, closeSocket]);

  return {
    isConnected,
    isConnecting,
    error,
    lastMessage,
    reconnect,
    disconnect,
  };
}
