import type { ChangeEvent, KeyboardEvent } from "react";

export function readTextFieldValue(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
): string {
  return event.currentTarget.value;
}

export function readFirstSelectedFile(event: ChangeEvent<HTMLInputElement>): File | null {
  const files = event.currentTarget.files;
  if (!files || files.length === 0) return null;
  return files[0] ?? null;
}

export function isEnterKey(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.key === "Enter";
}
