import { describe, expect, it } from "vitest";
import { canonicalPublicationJson, sha256Hex } from "./publicationHash";

describe("publication hashing", () => {
  it("canonicalizes object keys recursively without reordering arrays", () => {
    expect(canonicalPublicationJson({ z: 1, a: { y: 2, b: 3 }, list: [{ z: 1, a: 2 }] }))
      .toBe('{"a":{"b":3,"y":2},"list":[{"a":2,"z":1}],"z":1}');
  });

  it("produces the standard SHA-256 digest", async () => {
    expect(await sha256Hex("abc"))
      .toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
