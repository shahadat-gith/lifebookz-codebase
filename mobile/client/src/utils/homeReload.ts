/**
 * Home reload bus — the tab layout can't reach the Home screen's query
 * directly, so the screen registers a reload handler here and the tab bar
 * triggers it when Home is tapped while already focused.
 */
type Handler = () => void;

let handler: Handler | null = null;

export function setHomeReloadHandler(fn: Handler | null) {
  handler = fn;
}

export function triggerHomeReload() {
  handler?.();
}
