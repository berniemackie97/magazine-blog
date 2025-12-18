import type { IssueRecord, PostRecord } from "./contentTypes";

export type PostWithExtras = PostRecord;

export type Lineup = {
  lead: PostWithExtras | null;
  secondary: PostWithExtras[];
  briefs: PostWithExtras[];
};

function toTime(value: string): number {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

function byDesc<T>(getKey: (item: T) => number) {
  return (a: T, b: T) => getKey(b) - getKey(a);
}

function coverPriority(post: PostWithExtras): number {
  return post.data.coverPriority ?? 0;
}

function isBrief(post: PostWithExtras): boolean {
  return post.data.format === "brief" || post.data.coverSlot === "brief";
}

function isFeatureLike(post: PostWithExtras): boolean {
  return post.data.format === "feature";
}

function uniqBySlug(posts: PostWithExtras[]): PostWithExtras[] {
  const seen = new Set<string>();
  const out: PostWithExtras[] = [];
  for (const p of posts) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push(p);
  }
  return out;
}

export function buildIssueLineup(
  posts: PostWithExtras[],
  issue: IssueRecord,
): Lineup {
  const uniquePosts = uniqBySlug(posts);
  const timeFor = (p: PostWithExtras) => toTime(p.data.publishedAt);
  const sortedByDate = [...uniquePosts].sort(byDesc(timeFor));

  const bySlug = new Map<string, PostWithExtras>();
  for (const p of uniquePosts) bySlug.set(p.slug, p);

  const overrides = issue.data.coverOverrides;
  const overrideLeadSlug = overrides?.leadPostSlug;
  const overrideSecondarySlugs = overrides?.secondaryPostSlugs ?? [];

  const pickBySlug = (slug: string | undefined): PostWithExtras | null => {
    if (!slug) return null;
    return bySlug.get(slug) ?? null;
  };

  let lead: PostWithExtras | null = pickBySlug(overrideLeadSlug);

  if (!lead) {
    const leadSlotCandidates = uniquePosts
      .filter((p) => p.data.coverSlot === "lead")
      .sort(
        (a, b) =>
          coverPriority(b) - coverPriority(a) || timeFor(b) - timeFor(a),
      );

    if (leadSlotCandidates.length > 0) {
      lead = leadSlotCandidates[0];
    } else {
      const featureCandidates = uniquePosts
        .filter(isFeatureLike)
        .sort(byDesc(timeFor));
      if (featureCandidates.length > 0) {
        lead = featureCandidates[0];
      } else {
        lead = sortedByDate.find((p) => !isBrief(p)) ?? sortedByDate[0] ?? null;
      }
    }
  }

  const leadSlug = lead?.slug ?? null;

  let secondary: PostWithExtras[] = [];

  if (overrideSecondarySlugs.length > 0) {
    secondary = overrideSecondarySlugs
      .map((slug) => bySlug.get(slug))
      .filter((p): p is PostWithExtras => Boolean(p))
      .filter((p) => p.slug !== leadSlug);

    secondary = uniqBySlug(secondary).slice(0, 4);
  }

  if (secondary.length === 0) {
    const slotSecondary = uniquePosts
      .filter((p) => p.data.coverSlot === "secondary" && p.slug !== leadSlug)
      .sort(
        (a, b) =>
          coverPriority(b) - coverPriority(a) || timeFor(b) - timeFor(a),
      );

    if (slotSecondary.length > 0) {
      secondary = slotSecondary.slice(0, 4);
    } else {
      secondary = sortedByDate
        .filter((p) => !isBrief(p) && p.slug !== leadSlug)
        .slice(0, 4);
    }
  }

  const secondarySlugs = new Set(secondary.map((p) => p.slug));

  const briefs = sortedByDate
    .filter(isBrief)
    .filter((p) => p.slug !== leadSlug && !secondarySlugs.has(p.slug));

  return { lead, secondary, briefs };
}

export function coverLinesFromPosts(
  posts: PostWithExtras[],
  max = 6,
): string[] {
  const uniquePosts = uniqBySlug(posts);
  const timeFor = (p: PostWithExtras) => toTime(p.data.publishedAt);

  const primaryCandidates = uniquePosts
    .filter((p) => !isBrief(p))
    .sort(
      (a, b) => coverPriority(b) - coverPriority(a) || timeFor(b) - timeFor(a),
    )
    .map((p) => p.data.headline);

  const briefCandidates = uniquePosts
    .filter(isBrief)
    .sort(byDesc(timeFor))
    .map((p) => p.data.headline);

  const lines: string[] = [];
  const seen = new Set<string>();

  const push = (text: string | undefined) => {
    const t = (text ?? "").trim();
    if (!t) return;
    if (seen.has(t)) return;
    seen.add(t);
    lines.push(t);
  };

  for (const h of primaryCandidates) push(h);

  if (lines.length < 3) {
    for (const h of briefCandidates) push(h);
  }

  if (lines.length < 3) push("Inside: field notes and tools");
  if (lines.length < 4) push("Plus: editor dispatch");

  return lines.slice(0, max);
}
