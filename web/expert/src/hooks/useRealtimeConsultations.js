/**
 * AWS API Gateway WebSocket live-feed for the expert dashboard.
 *
 * API Gateway WebSocket APIs speak plain WebSocket + a JSON envelope:
 *   client → { action, ...data }        (routed to Lambda by `action`)
 *   Lambda → { event, payload }         (pushed back over the socket)
 *
 * No socket.io, no extra SDK. The dashboard identifies itself with
 * `register` (expertId) AND subscribes to every consultation id in its
 * list — the same routing path the client app's waiting screen uses, which
 * is the path the backend demonstrably drives. New PENDING requests still
 * depend on the backend's expertId routing (`register` + the
 * `POST /consultations/requests` Lambda — see docs/realtime-websocket-
 * backend.md §4); the dashboard's 30s visible-tab poll covers that gap.
 *
 * Env: VITE_WS_URL — the wss:// execute-api invoke URL, e.g.
 *   wss://abc123.execute-api.us-east-1.amazonaws.com/prod
 */
import { useEffect, useRef, useState } from "react";

const PING_INTERVAL_MS = 25_000; // below API Gateway's 10-min idle timeout
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

/** Returns { status, lastEvent, subscribe } — status: idle|connecting|open|closed|error. */
export default function useRealtimeConsultations(onEvent, expertId) {
  const [status, setStatus] = useState("idle");
  const [lastEvent, setLastEvent] = useState(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Consultation ids this dashboard wants frames for. Kept in a ref so the
  // socket reconnect / re-subscribe logic can read the latest set without
  // re-running the connection effect.
  const subscriptionsRef = useRef(new Set());
  // Bumped every time the subscription set changes while the socket is up,
  // so fresh subscribes go out immediately on the open connection.
  const [subscriptionsVersion, setSubscriptionsVersion] = useState(0);
  // Point wsRef at the live connection so subscribe()/unsubscribe() calls
  // from the component can find the open socket (the connection effect's
  // local `ws` closure can't be reached from outside).
  const wsRef = useRef(null);
  const connectedRef = useRef(false);

  /** Ask the gateway to route this consultation's events to this socket. */
  const subscribe = (consultationId) => {
    if (!consultationId || subscriptionsRef.current.has(consultationId)) return;
    subscriptionsRef.current.add(consultationId);
    const ws = wsRef.current;
    if (connectedRef.current && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "subscribe", consultationId }));
    }
    setSubscriptionsVersion((v) => v + 1);
  };

  const unsubscribe = (consultationId) => {
    subscriptionsRef.current.delete(consultationId);
    const ws = wsRef.current;
    if (connectedRef.current && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "unsubscribe", consultationId }));
    }
  };

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

    const sendSubscriptions = () => {
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ action: "register", expertId }));
      subscriptionsRef.current.forEach((consultationId) => {
        ws.send(JSON.stringify({ action: "subscribe", consultationId }));
      });
      // Only after the frame batch goes out do we mark ourselves connected —
      // subscribe() calls made while connecting wait for the next reconnect
      // otherwise.
      connectedRef.current = true;
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
        wsRef.current = ws;
        // Identify this expert AND announce all current consultation
        // subscriptions — on the first connect and after every reconnect.
        sendSubscriptions();
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
        connectedRef.current = false;
        wsRef.current = null;
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
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
        ws.close();
        ws = null;
      }
      connectedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expertId]);

  // subscriptionsVersion exists only to make each subscribe() call observable
  // to React (dashboard can react to a changed set if needed); the socket
  // send itself happens eagerly inside subscribe().

  return { status, lastEvent, subscribe, unsubscribe };
}
