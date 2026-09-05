import { describe, expect, it } from "vitest";
import { parseChatCompletionStreamText } from "./chatCompletionStream";

describe("parseChatCompletionStreamText", () => {
  it("assembles delta content from SSE stream lines", () => {
    const raw = [
      'data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"Pyramid Baklava, "}}]}',
      'data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"Triangle Baklava"}}]}',
      "data: [DONE]",
    ].join("\n");
    expect(parseChatCompletionStreamText(raw)).toBe("Pyramid Baklava, Triangle Baklava");
  });

  it("returns trimmed raw text when no stream lines are present", () => {
    expect(parseChatCompletionStreamText("alias one, alias two")).toBe("alias one, alias two");
  });
});
