import { getIssues } from "./issues";
import { getPosts } from "./posts";
import { getPublicationMap, getPublications } from "./publications";
import type { Issue, Post, Publication, RackItem } from "./types";

export interface Shelf {
  publication: Publication;
  items: RackItem[];
}

/** Loads every issue once and joins it with its publication and posts. */
async function buildRackItems(issues: Issue[]): Promise<RackItem[]> {
  const [publications, posts] = await Promise.all([getPublicationMap(), getPosts()]);
  const postsByIssue = groupPostsByIssue(posts);

  return issues.map((issue) => {
    const publication = publications.get(issue.publicationId);
    if (!publication) {
      throw new Error(`Issue "${issue.key}" references unknown publication`);
    }
    return {
      issue,
      publication,
      posts: postsByIssue.get(`${issue.publicationId}/${issue.slug}`) ?? [],
    };
  });
}

export async function getFreshShelf(limit: number): Promise<RackItem[]> {
  const issues = (await getIssues()).filter((i) => i.status === "locked").slice(0, limit);
  return buildRackItems(issues);
}

export async function getPublicationShelves(options: { featuredOnly: boolean }): Promise<Shelf[]> {
  const [publications, issues] = await Promise.all([getPublications(), getIssues()]);
  const items = await buildRackItems(issues);

  return publications
    .filter((p) => !options.featuredOnly || p.featured)
    .map((publication) => ({
      publication,
      items: items.filter((item) => item.publication.id === publication.id),
    }));
}

export async function getShelfFor(publication: Publication): Promise<Shelf> {
  const issues = (await getIssues()).filter((i) => i.publicationId === publication.id);
  return { publication, items: await buildRackItems(issues) };
}

function groupPostsByIssue(posts: Post[]): Map<string, Post[]> {
  const map = new Map<string, Post[]>();
  for (const post of posts) {
    if (!post.issueSlug) continue;
    const key = `${post.publicationId}/${post.issueSlug}`;
    map.set(key, [...(map.get(key) ?? []), post]);
  }
  return map;
}
