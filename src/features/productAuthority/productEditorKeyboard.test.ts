import { describe, expect, it } from "vitest";
import { isProductSaveShortcut } from "./productEditorKeyboard";

const keyboardEvent = (overrides: Partial<Parameters<typeof isProductSaveShortcut>[0]> = {}) => ({
  key: "s",
  code: "KeyS",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

describe("isProductSaveShortcut", () => {
  it("accepts the standard Windows/Linux and macOS save shortcuts", () => {
    expect(isProductSaveShortcut(keyboardEvent({ ctrlKey: true }))).toBe(true);
    expect(isProductSaveShortcut(keyboardEvent({ key: "S", metaKey: true }))).toBe(true);
  });

  it("uses the physical S key on non-Latin keyboard layouts", () => {
    expect(isProductSaveShortcut(keyboardEvent({ key: "ы", code: "KeyS", ctrlKey: true }))).toBe(
      true,
    );
  });

  it("does not intercept plain or additionally modified keys", () => {
    expect(isProductSaveShortcut(keyboardEvent())).toBe(false);
    expect(isProductSaveShortcut(keyboardEvent({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isProductSaveShortcut(keyboardEvent({ metaKey: true, altKey: true }))).toBe(false);
    expect(isProductSaveShortcut(keyboardEvent({ key: "x", code: "KeyX", ctrlKey: true }))).toBe(
      false,
    );
  });
});
