import { describe, expect, it } from "vitest";
import { createSaveAttemptGate } from "./saveAttemptGate";

describe("save attempt gate", () => {
  it("blocks synchronous re-entry until the full attempt releases", () => {
    const gate = createSaveAttemptGate();
    expect(gate.tryEnter()).toBe(true);
    expect(gate.tryEnter()).toBe(false);
    expect(gate.isActive()).toBe(true);
    gate.release();
    expect(gate.tryEnter()).toBe(true);
  });
});
