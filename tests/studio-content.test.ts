import { describe, it, expect } from "vitest";
import { compile } from "@mdx-js/mdx";
import { readFile } from "node:fs/promises";
import {
  decode,
  encode,
  entryPath,
  isContentPath,
  isMediaPath,
  validateLibrary,
} from "../src/lib/studio/content";
import { mdxPolicy, safeUrl } from "../src/lib/studio/mdx-policy";
const article = "src/content/posts/signal-hunt.mdx";
describe("editorial content", () => {
  it("round-trips the real component-rich article without altering its body", async () => {
    const source = await readFile(article, "utf8");
    const entry = decode(article, source);
    const roundtrip = decode(article, encode(entry));
    expect(roundtrip.body).toBe(entry.body);
    expect(roundtrip.data).toEqual(entry.data);
    await expect(
      compile(entry.body, { remarkPlugins: [mdxPolicy] }),
    ).resolves.toBeDefined();
  });
  it("rejects ambiguous frontmatter and broken relationships", async () => {
    expect(() =>
      decode(article, "---\nheadline: one\nheadline: two\n---\ntext"),
    ).toThrow();
    const post = decode(article, await readFile(article, "utf8"));
    expect(() => validateLibrary([post])).toThrow("existing publication");
  });
  it.each(["../../package", "hello/world", "Foo", "a%2fb", "a\\b", "a\u0000"])(
    "rejects unsafe slugs: %s",
    (slug) => expect(() => entryPath("posts", slug)).toThrow(),
  );
  it("only accepts the managed content and image directories", () => {
    expect(isContentPath("src/content/posts/a.mdx")).toBe(true);
    expect(isContentPath("src/pages/index.astro")).toBe(false);
    expect(isContentPath("src/content/posts/../../a.mdx")).toBe(false);
    expect(isMediaPath("public/media/a.webp")).toBe(true);
    expect(isMediaPath("public/media/../a.webp")).toBe(false);
    expect(isMediaPath("public/media/script.svg")).toBe(false);
  });
});
describe("MDX execution boundary", () => {
  it.each([
    'import fs from "node:fs"\n\nhello',
    "{process.env.SECRET}",
    "<Callout title={globalThis.process.exit()} />",
    '<img src="javascript:alert(1)" />',
    '<div onClick="alert(1)">x</div>',
    "<script>alert(1)</script>",
    "<Callout {...props} />",
    '<Callout items="not-an-array" />',
    '<ResourceCard title="Example" href="/ok" altSources={[{ label: "Bad", href: "javascript:alert(1)" }]} />',
    "[link](javascript:alert%281%29)",
  ])("rejects executable or unsafe syntax: %s", async (source) => {
    await expect(
      compile(source, { remarkPlugins: [mdxPolicy] }),
    ).rejects.toThrow();
  });
  it("accepts literal component props, comments, and ordinary code examples", async () => {
    await expect(
      compile(
        '<Callout items={["a", "b"]} checklist />\n\n{/* a comment */}\n\n```js\nprocess.env.SECRET\n```',
        { remarkPlugins: [mdxPolicy] },
      ),
    ).resolves.toBeDefined();
  });
  it.each([
    "java\tscript:alert(1)",
    "\u200bjavascript:alert(1)",
    "//evil.test",
  ])("rejects disguised unsafe URLs", (url) =>
    expect(safeUrl(url)).toBe(false),
  );
});
