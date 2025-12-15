import type { CollectionEntry } from 'astro:content';

type PostEntry = CollectionEntry<'posts'> & { readingTimeMinutes?: number };

export function buildIssueLineup(posts: PostEntry[], issue: CollectionEntry<'issues'>) {
  const sortedByDate = [...posts].sort(
    (a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime()
  );

  const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));

  let lead: PostEntry | undefined;
  let secondary: PostEntry[] = [];
  let briefs: PostEntry[] = posts.filter((p) => p.data.format === 'brief');

  if (issue.data.coverOverrides) {
    const { leadPostSlug, secondaryPostSlugs } = issue.data.coverOverrides;
    if (leadPostSlug && bySlug[leadPostSlug]) {
      lead = bySlug[leadPostSlug];
    }
    if (secondaryPostSlugs) {
      secondary = secondaryPostSlugs.map((slug) => bySlug[slug]).filter(Boolean) as PostEntry[];
    }
  }

  if (!lead) {
    const leadCandidates = posts.filter((p) => p.data.coverSlot === 'lead');
    if (leadCandidates.length > 0) {
      lead = leadCandidates.sort((a, b) => (b.data.coverPriority ?? 0) - (a.data.coverPriority ?? 0))[0];
    } else {
      const features = posts.filter((p) => p.data.format === 'feature');
      lead = features.length > 0 ? features.sort((a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime())[0] : sortedByDate[0];
    }
  }

  if (secondary.length === 0) {
    const slotSecondary = posts
      .filter((p) => p.data.coverSlot === 'secondary' && p.slug !== lead?.slug)
      .sort(
        (a, b) =>
          (b.data.coverPriority ?? 0) - (a.data.coverPriority ?? 0) ||
          new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime()
      );
    if (slotSecondary.length > 0) {
      secondary = slotSecondary.slice(0, 4);
    } else {
      secondary = sortedByDate.filter((p) => p.data.format !== 'brief' && p.slug !== lead?.slug).slice(0, 4);
    }
  }

  briefs = briefs
    .filter((p) => p.slug !== lead?.slug && !secondary.find((s) => s.slug === p.slug))
    .sort((a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime());

  return { lead, secondary, briefs };
}

export function coverLinesFromPosts(posts: PostEntry[], max = 6) {
  const primaries = posts
    .filter((p) => p.data.format !== 'brief')
    .sort(
      (a, b) =>
        (b.data.coverPriority ?? 0) - (a.data.coverPriority ?? 0) ||
        new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime()
    )
    .map((p) => p.data.headline);

  const lines = [...primaries];
  if (lines.length < 3) {
    const briefs = posts.filter((p) => p.data.format === 'brief').map((p) => p.data.headline);
    lines.push(...briefs);
  }
  if (lines.length < 3) {
    lines.push('Inside: field notes and tools');
  }
  if (lines.length < 4) {
    lines.push('Plus: editor dispatch');
  }
  return lines.slice(0, max);
}
