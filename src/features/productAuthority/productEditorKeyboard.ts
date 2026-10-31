type SaveShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

/** Ctrl/Cmd+S only; modified variants stay available to the browser and assistive tooling. */
export function isProductSaveShortcut(event: SaveShortcutEvent): boolean {
  const isSKey = event.key.toLowerCase() === "s" || event.code === "KeyS";
  return isSKey && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}
