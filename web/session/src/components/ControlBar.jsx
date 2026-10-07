import { Icon, Paths } from "./Icons";

/** One round session control — state is shown by the icon, not the background. */
function ControlButton({ onClick, off = false, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm transition-all active:scale-95 hover:bg-muted ${
        off ? "text-muted-foreground" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Mic / camera / chat controls, plus the End session button — expert only,
 * the same rule the portals always had (clients can't close a session).
 */
export default function ControlBar({
  micOn,
  cameraOn,
  toggleMic,
  toggleCamera,
  onToggleChat,
  unread,
  isExpert,
  onEnd,
}) {
  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card p-2 shadow-md">
        <ControlButton
          onClick={toggleMic}
          label={micOn ? "Mute microphone" : "Unmute microphone"}
          off={!micOn}
        >
          <Icon path={micOn ? Paths.mic : Paths.micOff} />
        </ControlButton>

        <ControlButton
          onClick={toggleCamera}
          label={cameraOn ? "Turn camera off" : "Turn camera on"}
          off={!cameraOn}
        >
          <Icon path={cameraOn ? Paths.camera : Paths.cameraOff} />
        </ControlButton>

        <div className="relative">
          <ControlButton onClick={onToggleChat} label="Toggle chat">
            <Icon path={Paths.chat} />
          </ControlButton>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shadow-sm">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>

      {isExpert && (
        <button
          type="button"
          onClick={onEnd}
          aria-label="End session"
          title="End session"
          className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-rose-600 active:scale-95"
        >
          <Icon path={Paths.close} className="h-4 w-4" />
          End session
        </button>
      )}
    </div>
  );
}
