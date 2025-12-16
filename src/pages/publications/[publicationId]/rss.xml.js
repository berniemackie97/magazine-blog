import rss from '@astrojs/rss';
import { getCollection, getEntry } from 'astro:content';

export async function getStaticPaths() {
  const publications = await getCollection('publications');
  return publications.map((pub) => ({ params: { publicationId: pub.id } }));
}

export async function GET(context) {
  const { publicationId } = context.params;
  const publication = publicationId ? await getEntry('publications', publicationId) : null;
  if (!publication) {
    return new Response('Not found', { status: 404 });
  }

  const posts = await getCollection(
    'posts',
    ({ data }) => !data.draft && data.publicationId === publication.id
  );

  return rss({
    title: `${publication.data.name} — Stackbound`,
    description: publication.data.description,
    site: context.site ?? 'http://localhost:4321',
    items: posts
      .sort((a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime())
      .map((post) => ({
        title: post.data.headline,
        pubDate: new Date(post.data.publishedAt),
        description: post.data.summary,
        link: `/posts/${post.slug}`,
      })),
  });
}
