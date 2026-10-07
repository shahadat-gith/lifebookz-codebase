import { useEffect, useRef, useState } from "react";

/**
 * AWS API Gateway WebSocket client for Lifebookz realtime events.
 *
 * API Gateway WebSocket APIs speak plain WebSocket + a JSON envelope:
 * the client sends `{ action, ...data }`, routes are matched on `action`,
 * and Lambda pushes `{ event, payload }` frames back over the connection.
 * No socket.io, no SigV4 — just the browser/RN WebSocket API, so it works
 * identically here, in the web client, and in the expert portal.
 *
 * Env: EXPO_PUBLIC_WS_URL — the wss:// execute-api invoke URL, e.g.
 *   wss://abc123.execute-api.us-east-1.amazonaws.com/prod
 */

export type ConsultationEventName =
  | "consultation.confirmed"
  | "consultation.cancelled"
  | "consultation.expired"
  | "consultation.updated"
  | "ping";

export interface ConsultationEvent {
  event: ConsultationEventName;
  consultationId?: string;
  consultation?: {
    _id?: string;
    id?: string;
    status?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

type Listener = (event: ConsultationEvent) => void;

export type SocketStatus = "idle" | "connecting" | "open" | "closed" | "error";

interface SendPayload {
  [key: string]: unknown;
}

const PING_INTERVAL_MS = 25_000; // below API Gateway's 10-min idle limit
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

export class ConsultationSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(s: SocketStatus) => void>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private disposed = false;
  private status: SocketStatus = "idle";

  constructor(private url: string) {}

  static fromEnv(): ConsultationSocket | null {
    const url = process.env.EXPO_PUBLIC_WS_URL;
    return url ? new ConsultationSocket(url.replace(/\/$/, "")) : null;
  }

  getStatus() {
    return this.status;
  }

  onStatus(listener: (s: SocketStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Send a routed action, e.g. `{ action: "subscribe", consultationId }`. */
  send(action: string, payload: SendPayload = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...payload }));
    }
  }

  connect() {
    if (this.disposed || this.ws) return;
    this.setStatus("connecting");
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleRetry();
      return;
    }

    this.ws.onopen = () => {
      this.attempts = 0;
      this.setStatus("open");
      this.startPing();
      // Re-announce subscriptions after any reconnect.
      this.subscriptions.forEach((consultationId) =>
        this.send("subscribe", { consultationId }),
      );
    };

    this.ws.onmessage = (raw) => {
      let parsed: ConsultationEvent;
      try {
        parsed = JSON.parse(raw.data) as ConsultationEvent;
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
      this.setStatus("error");
      // onclose follows; retry is scheduled there.
    };
  }

  private subscriptions = new Set<string>();

  /** Ask the gateway to route events for this consultation to this socket. */
  subscribe(consultationId: string) {
    this.subscriptions.add(consultationId);
    this.send("subscribe", { consultationId });
  }

  unsubscribe(consultationId: string) {
    this.subscriptions.delete(consultationId);
    this.send("unsubscribe", { consultationId });
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      // App-level ping keeps the connection warm; API Gateway drops idle
      // sockets at 10 minutes.
      this.send("ping", { at: Date.now() });
    }, PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleRetry() {
    if (this.disposed || this.retryTimer) return;
    const delay = Math.min(BASE_RETRY_MS * 2 ** this.attempts, MAX_RETRY_MS);
    this.attempts += 1;
    this.setStatus("closed");
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.ws = null;
      this.connect();
    }, delay);
  }

  private cleanup() {
    this.stopPing();
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null;
      this.ws = null;
    }
  }

  private setStatus(next: SocketStatus) {
    this.status = next;
    this.statusListeners.forEach((l) => l(next));
  }

  dispose() {
    this.disposed = true;
    this.stopPing();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.cleanup();
    }
    this.listeners.clear();
    this.statusListeners.clear();
  }
}

/** Module-level singleton so every screen shares one socket + connection. */
let shared: ConsultationSocket | null = null;

export function getSharedSocket(): ConsultationSocket | null {
  if (!shared) shared = ConsultationSocket.fromEnv();
  return shared;
}

export function closeSharedSocket() {
  shared?.dispose();
  shared = null;
}

/**
 * React hook: subscribes to one consultation and returns live status +
 * events. Falls back gracefully (idle status, no events) when
 * EXPO_PUBLIC_WS_URL isn't configured.
 */
export function useConsultationEvents(consultationId?: string | null) {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [lastEvent, setLastEvent] = useState<ConsultationEvent | null>(null);
  const socketRef = useRef<ConsultationSocket | null>(null);

  useEffect(() => {
    if (!consultationId) return;
    const socket = getSharedSocket();
    if (!socket) return;
    socketRef.current = socket;

    socket.connect();
    socket.subscribe(consultationId);
    const offStatus = socket.onStatus(setStatus);
    const offEvent = socket.on((event) => {
      if (
        event.consultationId === consultationId ||
        event.consultation?._id === consultationId ||
        event.consultation?.id === consultationId
      ) {
        setLastEvent(event);
      }
    });

    return () => {
      socket.unsubscribe(consultationId);
      offStatus();
      offEvent();
    };
  }, [consultationId]);

  return { status, lastEvent };
}
