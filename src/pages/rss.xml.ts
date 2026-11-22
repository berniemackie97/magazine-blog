import type { APIRoute } from "astro";
import { site } from "../config/site";
import { getPosts } from "../lib/content/posts";
import { buildFeed } from "../lib/feeds";

export const GET: APIRoute = async (context) =>
  buildFeed({
    title: site.name,
    description: site.description,
    site: context.site!,
    posts: await getPosts(),
  });
