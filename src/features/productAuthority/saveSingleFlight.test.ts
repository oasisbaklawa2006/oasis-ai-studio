import { describe, expect, it } from "vitest";
import { releaseSingleFlight, tryAcquireSingleFlight } from "./saveSingleFlight";

describe("Full Editor save single-flight guard", () => {
  it("rejects a rapid second save until the first releases the guard", () => {
    const ref = { current: false };

    expect(tryAcquireSingleFlight(ref)).toBe(true);
    expect(tryAcquireSingleFlight(ref)).toBe(false);

    releaseSingleFlight(ref);

    expect(tryAcquireSingleFlight(ref)).toBe(true);
  });

  it("can be released after an error path and acquired again", () => {
    const ref = { current: false };

    expect(tryAcquireSingleFlight(ref)).toBe(true);
    releaseSingleFlight(ref);
    expect(ref.current).toBe(false);
    expect(tryAcquireSingleFlight(ref)).toBe(true);
  });
});
