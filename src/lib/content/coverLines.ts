import { compareIsoDatesDesc } from "../dates";

export interface CoverLineSource {
  headline: string;
  format: string;
  coverPriority: number;
  publishedAt: string;
}

/**
 * Picks the headlines printed on a cover: editor-set lines win, otherwise the
 * issue's strongest stories (features before briefs, then by priority/date).
 */
export function coverLines(
  posts: readonly CoverLineSource[],
  override: readonly string[] | undefined,
  max: number,
): string[] {
  if (override && override.length > 0) return dedupe(override).slice(0, max);

  const ranked = [...posts].sort(
    (a, b) =>
      Number(a.format === "brief") - Number(b.format === "brief") ||
      b.coverPriority - a.coverPriority ||
      compareIsoDatesDesc(a.publishedAt, b.publishedAt),
  );
  return dedupe(ranked.map((p) => p.headline)).slice(0, max);
}

function dedupe(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line && !seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}
