import { getIssues } from "./issues";
import { getPosts } from "./posts";
import { getPublicationMap } from "./publications";
import type { Post, Publication } from "./types";

export interface PostListing {
  post: Post;
  publication: Publication;
  issueTitle?: string;
}

/** Published posts joined with their publication and issue title, newest first. */
export async function getPostListings(
  options: { publicationId?: string; limit?: number } = {},
): Promise<PostListing[]> {
  const [posts, publications, issues] = await Promise.all([
    getPosts(),
    getPublicationMap(),
    getIssues(),
  ]);
  const issueTitles = new Map(issues.map((i) => [`${i.publicationId}/${i.slug}`, i.title]));

  const listings = posts
    .filter((p) => !options.publicationId || p.publicationId === options.publicationId)
    .map((post) => {
      const publication = publications.get(post.publicationId);
      if (!publication) throw new Error(`Post "${post.id}" references unknown publication`);
      return {
        post,
        publication,
        issueTitle: post.issueSlug
          ? issueTitles.get(`${post.publicationId}/${post.issueSlug}`)
          : undefined,
      };
    });

  return options.limit ? listings.slice(0, options.limit) : listings;
}
