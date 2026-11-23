import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { decode } from "../src/lib/studio/content";

interface Result {
  id: number;
  source?: string;
  error?: string;
  line?: number;
}
const received = vi.fn();
const worker = {
  onmessage: undefined as
    | undefined
    | ((event: {
        data: { id: number; action: "lint" | "format"; source: string };
      }) => Promise<void>),
  postMessage: received,
};
async function processDocument(
  action: "lint" | "format",
  source: string,
): Promise<Result> {
  received.mockClear();
  await worker.onmessage!({ data: { id: 1, action, source } });
  return received.mock.calls[0]![0] as Result;
}
beforeAll(async () => {
  vi.stubGlobal("self", worker);
  await import("../src/scripts/studio/editor.worker");
});
afterAll(() => vi.unstubAllGlobals());
describe("article analysis worker", () => {
  it("formats existing articles into MDX accepted by the same component rules", async () => {
    for (const name of await readdir("src/content/posts")) {
      if (!name.endsWith(".mdx")) continue;
      const path = `src/content/posts/${name}`;
      const { body } = decode(path, await readFile(path, "utf8"));
      const result = await processDocument("format", body);
      expect(result.error, name).toBeUndefined();
      expect(result.source).toBeTypeOf("string");
      expect(
        (await processDocument("lint", result.source!)).error,
        name,
      ).toBeUndefined();
    }
  });
  it("formats property arrays and preserves MDX comments", async () => {
    const result = await processDocument(
      "format",
      '{/* A private editorial comment. */}\n\n<Callout title="Checklist" items={["One","Two"]} />',
    );
    expect(result.error).toBeUndefined();
    expect(result.source).toContain("{/* A private editorial comment. */}");
    expect(result.source).toMatch(/items=\{\["One", "Two"\]\}/);
    expect(
      (await processDocument("lint", result.source!)).error,
    ).toBeUndefined();
  });
  it("reports component errors on their actual source line", async () => {
    const result = await processDocument(
      "lint",
      '\n\n<ResourceCard title="Resource" href="https://example.com" tone="invalid" />',
    );
    expect(result.error).toContain("ResourceCard");
    expect(result.line).toBe(3);
  });
  it("rejects executable expressions without running them", async () => {
    const result = await processDocument(
      "lint",
      "{globalThis.studioExpressionExecuted = true}",
    );
    expect(result.error).toContain("literal");
    expect("studioExpressionExecuted" in globalThis).toBe(false);
  });
});
