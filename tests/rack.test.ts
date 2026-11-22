import { describe, expect, it } from "vitest";
import { coverLines } from "../src/lib/content/coverLines";
import { FIRST_ARTICLE_PAGE, pagesFor, startPages } from "../src/lib/content/folio";
import { tiltFor } from "../src/lib/tilt";

describe("tiltFor", () => {
  it("is deterministic", () => {
    expect(tiltFor("fresh:red-ops-vol-0-preflight")).toBe(tiltFor("fresh:red-ops-vol-0-preflight"));
  });

  it("stays within bounds", () => {
    for (const key of ["a", "b", "red-ops", "field-guide", "x".repeat(200)]) {
      expect(Math.abs(tiltFor(key, 1.6))).toBeLessThanOrEqual(1.6);
    }
  });

  it("varies by key", () => {
    const angles = new Set(["a", "b", "c", "d", "e"].map((k) => tiltFor(k)));
    expect(angles.size).toBeGreaterThan(1);
  });
});

describe("coverLines", () => {
  const post = (headline: string, format: string, coverPriority: number, publishedAt = "2024-01-01") => ({
    headline,
    format,
    coverPriority,
    publishedAt,
  });

  it("prefers editor overrides", () => {
    expect(coverLines([post("A", "feature", 9)], ["Custom", "Custom", " "], 3)).toEqual(["Custom"]);
  });

  it("ranks features before briefs, then by priority", () => {
    const posts = [post("Brief", "brief", 99), post("Low", "feature", 1), post("High", "feature", 5)];
    expect(coverLines(posts, undefined, 3)).toEqual(["High", "Low", "Brief"]);
  });

  it("respects max", () => {
    expect(coverLines([post("A", "feature", 1), post("B", "feature", 2)], undefined, 1)).toEqual(["B"]);
  });
});

describe("folio", () => {
  it("adds an opener page to reading pages", () => {
    expect(pagesFor(1)).toBe(2);
    expect(pagesFor(6)).toBe(4);
  });

  it("chains start pages in running order", () => {
    const pages = startPages([
      { id: "a", readingMinutes: 6 },
      { id: "b", readingMinutes: 1 },
    ]);
    expect(pages.get("a")).toBe(FIRST_ARTICLE_PAGE);
    expect(pages.get("b")).toBe(FIRST_ARTICLE_PAGE + 4);
  });
});
