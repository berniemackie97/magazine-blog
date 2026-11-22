import { getCollection } from "astro:content";
import readingTime from "reading-time";
import { compareIsoDatesDesc } from "../dates";
import { getIssues } from "./issues";
import { getPublicationMap } from "./publications";
import type { Post, PostEntry } from "./types";

function toPost(entry: PostEntry): Post {
  const { publication, issue, ...data } = entry.data;
  return {
    ...data,
    id: entry.id,
    publicationId: publication.id,
    issueSlug: issue,
    readingMinutes: Math.max(
      1,
      Math.round(readingTime(entry.body ?? "").minutes),
    ),
    entry,
  };
}

/** Published posts, newest first. Fails the build on broken references. */
export async function getPosts(): Promise<Post[]> {
  const entries = await getCollection("posts", ({ data }) => !data.draft);
  const allIssues = await getCollection("issues");
  const hiddenIssues = new Set(
    allIssues
      .filter((i) => i.data.visibility === "draft")
      .map((i) => `${i.data.publication.id}/${i.data.slug}`),
  );
  const posts = entries
    .map(toPost)
    .filter(
      (p) =>
        !p.issueSlug || !hiddenIssues.has(`${p.publicationId}/${p.issueSlug}`),
    )
    .sort((a, b) => compareIsoDatesDesc(a.publishedAt, b.publishedAt));
  await assertReferences(posts);
  return posts;
}

export async function getPostsForPublication(
  publicationId: string,
): Promise<Post[]> {
  return (await getPosts()).filter((p) => p.publicationId === publicationId);
}

export async function getPostsForIssue(
  publicationId: string,
  issueSlug: string,
): Promise<Post[]> {
  return (await getPostsForPublication(publicationId)).filter(
    (p) => p.issueSlug === issueSlug,
  );
}

/** Explicit article order, then publication date. */
export function byRunningOrder(a: Post, b: Post): number {
  return a.order - b.order || compareIsoDatesDesc(a.publishedAt, b.publishedAt);
}

async function assertReferences(posts: Post[]): Promise<void> {
  const publications = await getPublicationMap();
  const issueKeys = new Set(
    (await getIssues()).map((i) => `${i.publicationId}/${i.slug}`),
  );

  for (const post of posts) {
    const publication = publications.get(post.publicationId);
    if (!publication)
      throw new Error(`Post "${post.id}" references unknown publication`);
    if (!publication.sections.some((s) => s.id === post.section)) {
      throw new Error(
        `Post "${post.id}" uses section "${post.section}" which ${publication.name} does not define`,
      );
    }
    if (
      post.issueSlug &&
      !issueKeys.has(`${post.publicationId}/${post.issueSlug}`)
    ) {
      throw new Error(
        `Post "${post.id}" references unknown issue "${post.issueSlug}"`,
      );
    }
  }
}
