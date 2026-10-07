import { Icon, Paths } from "./Icons";

/**
 * The two-tile video stage — peer and local video, stacked on mobile and
 * side by side on desktop, exactly like the portals' previous room.
 */
export default function VideoStage({
  bindLocalVideo,
  bindRemoteVideo,
  peerLabel,
  peerTileLabel,
  cameraOn,
  remoteVideoOn,
  connecting,
  connectingTitle,
}) {
  return (
    <div className="relative grid grid-rows-2 gap-2 overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-lg md:aspect-video md:grid-cols-2 md:grid-rows-1">
      {/* Remote participant */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted md:aspect-auto">
        <span className="absolute left-2 top-2 z-10 rounded-full bg-slate-900/70 px-2.5 py-1 text-[10px] font-bold text-white">
          {peerTileLabel}
        </span>
        <video
          ref={bindRemoteVideo}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        {!connecting && !remoteVideoOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 px-4 text-center">
            <Icon path={Paths.camera} className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">
              Waiting for {peerLabel}…
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Audio and chat are live.
            </p>
          </div>
        )}
      </div>

      {/* You */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted md:aspect-auto">
        <span className="absolute left-2 top-2 z-10 rounded-full bg-slate-900/70 px-2.5 py-1 text-[10px] font-bold text-white">
          You
        </span>
        <video
          ref={bindLocalVideo}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        {!connecting && !cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 px-4 text-center">
            <Icon path={Paths.camera} className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">Your camera is off</p>
          </div>
        )}
      </div>

      {connecting && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-background/95">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">{connectingTitle}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Keep this tab open. The session starts the moment both of you
              are connected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
