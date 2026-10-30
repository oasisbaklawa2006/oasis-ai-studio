type SaveShortcutEvent = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">;

/** Ctrl/Cmd+S only; modified variants stay available to the browser and assistive tooling. */
export function isProductSaveShortcut(event: SaveShortcutEvent): boolean {
  return (
    event.key.toLowerCase() === "s" &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}
