import rss from "@astrojs/rss";
import { site } from "../config/site";
import { parseIsoDate } from "./dates";
import type { Post } from "./content/types";
import { urls } from "./urls";

interface FeedOptions {
  title: string;
  description: string;
  site: URL;
  posts: Post[];
}

export function buildFeed({ title, description, site: siteUrl, posts }: FeedOptions) {
  return rss({
    title,
    description,
    site: siteUrl,
    customData: `<language>${site.locale.toLowerCase()}</language>`,
    items: posts.map((post) => ({
      title: post.headline,
      pubDate: parseIsoDate(post.publishedAt),
      description: post.summary || post.dek,
      link: urls.post(post.id),
      categories: post.tags,
    })),
  });
}
