/**
 * AWS API Gateway WebSocket live-feed for the expert dashboard.
 *
 * API Gateway WebSocket APIs speak plain WebSocket + a JSON envelope:
 *   client → { action, ...data }        (routed to Lambda by `action`)
 *   Lambda → { event, payload }         (pushed back over the socket)
 *
 * No socket.io, no extra SDK. New PENDING requests and any status change
 * appear here the moment the client confirms/expires/cancels — the
 * dashboard just refetches on each event, so the UI never goes stale.
 *
 * Env: VITE_WS_URL — the wss:// execute-api invoke URL, e.g.
 *   wss://abc123.execute-api.us-east-1.amazonaws.com/prod
 */
import { useEffect, useRef, useState } from "react";

const PING_INTERVAL_MS = 25_000; // below API Gateway's 10-min idle timeout
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

/** Returns { status, lastEvent } — status: idle|connecting|open|closed|error. */
export default function useRealtimeConsultations(onEvent, expertId) {
  const [status, setStatus] = useState("idle");
  const [lastEvent, setLastEvent] = useState(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const url = import.meta.env.VITE_WS_URL;
    if (!url || !expertId) {
      setStatus("idle");
      return undefined;
    }

    let ws = null;
    let pingTimer = null;
    let retryTimer = null;
    let attempts = 0;
    let disposed = false;

    const startPing = () => {
      stopPing();
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: "ping", at: Date.now() }));
        }
      }, PING_INTERVAL_MS);
    };

    const stopPing = () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
    };

    const scheduleRetry = () => {
      if (disposed || retryTimer) return;
      const delay = Math.min(BASE_RETRY_MS * 2 ** attempts, MAX_RETRY_MS);
      attempts += 1;
      setStatus("closed");
      retryTimer = setTimeout(() => {
        retryTimer = null;
        ws = null;
        connect();
      }, delay);
    };

    function connect() {
      if (disposed || ws) return;
      setStatus("connecting");
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleRetry();
        return;
      }

      ws.onopen = () => {
        attempts = 0;
        setStatus("open");
        startPing();
        // Identify this expert so the backend knows where to route events.
        ws.send(JSON.stringify({ action: "register", expertId }));
      };

      ws.onmessage = (raw) => {
        let parsed = null;
        try {
          parsed = JSON.parse(raw.data);
        } catch {
          return;
        }
        setLastEvent(parsed);
        if (onEventRef.current) onEventRef.current(parsed);
      };

      ws.onclose = () => {
        stopPing();
        if (ws) {
          ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
          ws = null;
        }
        if (!disposed) scheduleRetry();
      };

      ws.onerror = () => {
        setStatus("error");
      };
    }

    connect();

    return () => {
      disposed = true;
      stopPing();
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) {
        ws.close();
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
        ws = null;
      }
    };
  }, [expertId]);

  return { status, lastEvent };
}
