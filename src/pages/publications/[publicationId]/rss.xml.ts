import type { APIRoute, GetStaticPaths } from "astro";
import { site } from "../../../config/site";
import { getPostsForPublication } from "../../../lib/content/posts";
import { getPublications } from "../../../lib/content/publications";
import type { Publication } from "../../../lib/content/types";
import { buildFeed } from "../../../lib/feeds";

export const getStaticPaths = (async () => {
  const publications = await getPublications();
  return publications.map((publication) => ({
    params: { publicationId: publication.id },
    props: { publication },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ publication: Publication }> = async (context) => {
  const { publication } = context.props;
  return buildFeed({
    title: `${publication.name} · ${site.name}`,
    description: publication.description,
    site: context.site!,
    posts: await getPostsForPublication(publication.id),
  });
};
