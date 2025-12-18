import { getCollection, getEntry, type CollectionEntry } from "astro:content";
import readingTime from "reading-time";
import type {
  IssueRecord,
  PostRecord,
  PublicationRecord,
  CoverSpec,
} from "./contentTypes";

type PublicationEntry = CollectionEntry<"publications">;
type IssueEntry = CollectionEntry<"issues">;
type PostEntry = CollectionEntry<"posts">;

function toTime(value: string): number {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

function fallbackCoverSpec(issueTitle: string): CoverSpec {
  return {
    template: "classic",
    layout: {
      cols: "1fr",
      areas: ["title"],
      minHeight: 520,
      pad: "12px 12px 12px 42px",
    },
    blocks: [
      {
        id: "title",
        type: "title",
        area: "title",
        title: issueTitle || "Untitled issue",
      },
    ],
  };
}

function isCoverSpec(value: unknown): value is CoverSpec {
  if (!value || typeof value !== "object") return false;
  const v = value as any;
  if (typeof v.template !== "string") return false;
  if (!v.layout || typeof v.layout !== "object") return false;
  if (typeof v.layout.cols !== "string") return false;
  if (!Array.isArray(v.layout.areas)) return false;
  if (!Array.isArray(v.blocks)) return false;
  return true;
}

function withReadingTime(entry: PostEntry): PostRecord {
  const stats = readingTime(entry.body ?? "");
  return {
    id: entry.slug,
    slug: entry.slug,
    data: {
      ...entry.data,
      tags: entry.data.tags ?? [],
      draft: entry.data.draft ?? false,
    },
    readingTimeMinutes: Math.max(1, Math.round(stats.minutes)),
  };
}

function toPublicationRecord(entry: PublicationEntry): PublicationRecord {
  return { id: entry.id, data: entry.data };
}

function toIssueRecord(entry: IssueEntry): IssueRecord {
  const dataAny = entry.data as any;

  const coverSpec: CoverSpec = isCoverSpec(dataAny.coverSpec)
    ? dataAny.coverSpec
    : fallbackCoverSpec(
        String(
          dataAny.displayTitle ?? entry.data.issueSlug ?? "Untitled issue",
        ),
      );

  return {
    id: entry.data.issueSlug,
    data: {
      ...entry.data,
      coverSpec,
    } as any,
  };
}

const publicationCache = new Map<string, PublicationRecord | null>();
const issuesByPubCache = new Map<string, IssueRecord[]>();
const issueByKeyCache = new Map<string, IssueRecord | null>();
const postsByIssueCache = new Map<string, PostRecord[]>();
const postsByPubCache = new Map<string, PostRecord[]>();
const postBySlugCache = new Map<string, PostRecord | null>();

export async function getPublications(): Promise<PublicationRecord[]> {
  const pubs = await getCollection("publications");
  return pubs.map(toPublicationRecord);
}

export async function getFeaturedPublications(): Promise<PublicationRecord[]> {
  const pubs = await getCollection("publications");
  return pubs.filter((p) => p.data.isFeatured).map(toPublicationRecord);
}

export async function getPublication(
  id: string,
): Promise<PublicationRecord | null> {
  if (publicationCache.has(id)) return publicationCache.get(id)!;

  const entry = await getEntry("publications", id);
  const rec = entry ? toPublicationRecord(entry) : null;

  publicationCache.set(id, rec);
  return rec;
}

export async function getIssue(
  publicationId: string,
  issueSlug: string,
): Promise<IssueRecord | null> {
  const key = `${publicationId}:${issueSlug}`;
  if (issueByKeyCache.has(key)) return issueByKeyCache.get(key)!;

  const issues = await getCollection("issues");
  const match =
    issues.find(
      (issue) =>
        issue.data.publicationId === publicationId &&
        issue.data.issueSlug === issueSlug,
    ) ?? null;

  const rec = match ? toIssueRecord(match) : null;
  issueByKeyCache.set(key, rec);
  return rec;
}

export async function getIssuesForPublication(
  publicationId: string,
): Promise<IssueRecord[]> {
  if (issuesByPubCache.has(publicationId))
    return issuesByPubCache.get(publicationId)!;

  const issues = await getCollection("issues");
  const out = issues
    .filter((issue) => issue.data.publicationId === publicationId)
    .sort((a, b) => toTime(b.data.date) - toTime(a.data.date))
    .map(toIssueRecord);

  issuesByPubCache.set(publicationId, out);
  return out;
}

export async function getPostsForIssue(
  publicationId: string,
  issueSlug: string,
): Promise<PostRecord[]> {
  const key = `${publicationId}:${issueSlug}`;
  if (postsByIssueCache.has(key)) return postsByIssueCache.get(key)!;

  const posts = await getCollection("posts", ({ data }) => !data.draft);
  const out = posts
    .filter(
      (post) =>
        post.data.publicationId === publicationId &&
        post.data.issueSlug === issueSlug,
    )
    .map(withReadingTime)
    .sort((a, b) => toTime(b.data.publishedAt) - toTime(a.data.publishedAt));

  postsByIssueCache.set(key, out);
  return out;
}

export async function getLatestLockedIssueForPublication(
  publicationId: string,
): Promise<IssueRecord | null> {
  const issues = await getIssuesForPublication(publicationId);
  const locked = issues.filter((i) => i.data.status === "locked");
  return locked[0] ?? null;
}

export async function getLatestIssues(limit = 6): Promise<IssueRecord[]> {
  const issues = await getCollection("issues");
  return issues
    .filter((i) => i.data.status === "locked")
    .sort((a, b) => toTime(b.data.date) - toTime(a.data.date))
    .slice(0, limit)
    .map(toIssueRecord);
}

export async function getLatestPosts(limit = 12): Promise<PostRecord[]> {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  return posts
    .map(withReadingTime)
    .sort((a, b) => toTime(b.data.publishedAt) - toTime(a.data.publishedAt))
    .slice(0, limit);
}

export async function getPostsByPublication(
  publicationId: string,
): Promise<PostRecord[]> {
  if (postsByPubCache.has(publicationId))
    return postsByPubCache.get(publicationId)!;

  const posts = await getCollection(
    "posts",
    ({ data }) => !data.draft && data.publicationId === publicationId,
  );
  const out = posts
    .map(withReadingTime)
    .sort((a, b) => toTime(b.data.publishedAt) - toTime(a.data.publishedAt));

  postsByPubCache.set(publicationId, out);
  return out;
}

export async function getPostBySlug(slug: string): Promise<PostRecord | null> {
  if (postBySlugCache.has(slug)) return postBySlugCache.get(slug)!;

  const posts = await getCollection(
    "posts",
    (entry) => !entry.data.draft && entry.slug === slug,
  );
  const entry = posts[0] ?? null;

  const rec = entry ? withReadingTime(entry) : null;
  postBySlugCache.set(slug, rec);
  return rec;
}
