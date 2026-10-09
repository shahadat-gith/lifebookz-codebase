/**
 * AWS API Gateway WebSocket client for Lifebookz realtime events — the web
 * client's mirror of the mobile app's src/api/realtime.ts (same JSON
 * envelope, same shared-socket pattern):
 *
 *   client → { action, ...data }        (routed to Lambda by `action`)
 *   Lambda → { event, payload }         (pushed back over the socket)
 *
 * No socket.io, no extra SDK. Env: VITE_WS_URL — the wss:// execute-api
 * invoke URL, e.g. wss://abc123.execute-api.us-east-1.amazonaws.com/prod
 */
import { useEffect, useRef } from "react";

const PING_INTERVAL_MS = 25_000; // below API Gateway's 10-min idle timeout
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

export class ConsultationSocket {
  constructor(url) {
    this.url = url.replace(/\/$/, "");
    this.ws = null;
    this.listeners = new Set();
    this.subscriptions = new Set();
    this.pingTimer = null;
    this.retryTimer = null;
    this.attempts = 0;
    this.disposed = false;
  }

  static fromEnv() {
    const url = import.meta.env.VITE_WS_URL;
    return url ? new ConsultationSocket(url) : null;
  }

  send(action, payload = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...payload }));
    }
  }

  connect() {
    if (this.disposed || this.ws) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleRetry();
      return;
    }

    this.ws.onopen = () => {
      this.attempts = 0;
      this.startPing();
      // Re-announce subscriptions after any reconnect.
      this.subscriptions.forEach((consultationId) =>
        this.send("subscribe", { consultationId }),
      );
    };

    this.ws.onmessage = (raw) => {
      let parsed;
      try {
        parsed = JSON.parse(raw.data);
      } catch {
        return; // non-JSON frame — ignore
      }
      this.listeners.forEach((listener) => listener(parsed));
    };

    this.ws.onclose = () => {
      this.cleanup();
      if (!this.disposed) this.scheduleRetry();
    };

    this.ws.onerror = () => {
      // onclose follows; retry is scheduled there.
    };
  }

  /** Ask the gateway to route events for this consultation to this socket. */
  subscribe(consultationId) {
    if (!consultationId || this.subscriptions.has(consultationId)) return;
    this.subscriptions.add(consultationId);
    this.send("subscribe", { consultationId });
  }

  unsubscribe(consultationId) {
    if (!consultationId) return;
    this.subscriptions.delete(consultationId);
    this.send("unsubscribe", { consultationId });
  }

  on(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      // App-level ping keeps the connection warm; API Gateway drops idle
      // sockets at 10 minutes.
      this.send("ping", { at: Date.now() });
    }, PING_INTERVAL_MS);
  }

  stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  scheduleRetry() {
    if (this.disposed || this.retryTimer) return;
    const delay = Math.min(BASE_RETRY_MS * 2 ** this.attempts, MAX_RETRY_MS);
    this.attempts += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.ws = null;
      this.connect();
    }, delay);
  }

  cleanup() {
    this.stopPing();
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null;
      this.ws = null;
    }
  }

  dispose() {
    this.disposed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.ws) this.ws.close();
    this.cleanup();
    this.listeners.clear();
    this.subscriptions.clear();
  }
}

/** Module-level singleton so every page shares one socket + connection. */
let shared = null;

export function getSharedSocket() {
  if (!shared) shared = ConsultationSocket.fromEnv();
  return shared;
}

/** The consultation id an event frame refers to, from any envelope shape. */
export function eventConsultationId(event) {
  return event?.consultationId || event?.consultation?._id || event?.consultation?.id;
}

/**
 * Subscribe to one consultation while mounted. `onEvent` receives every
 * frame for that consultation. Falls back gracefully (no-op) when
 * VITE_WS_URL isn't configured.
 */
export function useConsultationEvents(consultationId, onEvent) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!consultationId) return undefined;
    const socket = getSharedSocket();
    if (!socket) return undefined;

    socket.connect();
    socket.subscribe(consultationId);
    const offEvent = socket.on((event) => {
      if (eventConsultationId(event) === consultationId) {
        onEventRef.current?.(event);
      }
    });

    return () => {
      socket.unsubscribe(consultationId);
      offEvent();
    };
  }, [consultationId]);
}
