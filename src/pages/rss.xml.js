import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return rss({
    title: 'Stackbound Press',
    description: 'Issues and articles from the Stackbound imprint.',
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
