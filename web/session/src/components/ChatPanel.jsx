import { useEffect, useRef, useState } from "react";

import { Icon, Paths } from "./Icons";

/**
 * In-session chat. Messages ride the Chime meeting connection as real-time
 * data messages — instant, and they disappear with the session (nothing is
 * stored server-side).
 */
export default function ChatPanel({ open, onClose, messages, onSend, peerLabel }) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  if (!open) return null;

  const submit = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-x-0 top-0 bottom-20 z-30 flex justify-end bg-foreground/20 backdrop-blur-[2px] md:inset-x-auto md:inset-y-4 md:right-4 md:pointer-events-none md:bg-transparent md:backdrop-blur-none"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-sm flex-col overflow-hidden rounded-none border-l border-border bg-card shadow-lg md:pointer-events-auto md:h-auto md:rounded-2xl md:border md:shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Icon path={Paths.chat} className="h-4 w-4 text-primary" />
            In-session chat
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon path={Paths.close} className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Messages are visible only during this session — they are never
              stored.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.self ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    message.self
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground"
                  }`}
                >
                  {!message.self && (
                    <p className="mb-0.5 text-[11px] font-bold text-muted-foreground">
                      {message.name || peerLabel}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      message.self ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {message.at instanceof Date &&
                      message.at.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Message ${peerLabel}…`}
            maxLength={2000}
            className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-40"
          >
            <Icon path={Paths.arrowRight} className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
