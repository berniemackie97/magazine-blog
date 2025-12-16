import groq from 'groq';
import readingTime from 'reading-time';
import { client, previewClient } from './cmsClient';
import * as local from './data';

const useCms = !!client;

function textFromPortable(body: any[] | undefined): string {
  if (!body) return '';
  return body
    .map((block) => {
      if (block._type === 'block' && block.children) {
        return block.children.map((c: any) => c.text).join(' ');
      }
      if (block._type === 'pullQuote' && block.quote) return block.quote;
      if (block._type === 'sidebar' && block.body) return textFromPortable(block.body);
      return '';
    })
    .join(' ');
}

type CmsPost = {
  slug: { current: string };
  publication: { id: string; name: string };
  issueSlug?: string;
  sectionId: string;
  format: string;
  difficulty: string;
  publishedAt: string;
  updatedAt?: string;
  headline: string;
  dek: string;
  summary: string;
  tags?: string[];
  draft?: boolean;
  coverSlot?: string;
  coverPriority?: number;
  body?: any;
};

const postQuery = groq`*[_type=="post" && (!draft || draft==false)]`;

export async function getPublication(id: string) {
  if (!useCms) return local.getPublication(id);
  const pub = await client!.fetch(
    groq`*[_type=="publication" && id==$id][0]{..., "slug": id}`,
    { id }
  );
  return pub
    ? {
        id: pub.id,
        collection: 'publications',
        data: pub,
      }
    : null;
}

export async function getIssue(publicationId: string, issueSlug: string) {
  if (!useCms) return local.getIssue(publicationId, issueSlug);
  const issue = await client!.fetch(
    groq`*[_type=="issue" && issueSlug==$slug && publication->id==$pub][0]{..., "publicationId":publication->id}`,
    { slug: issueSlug, pub: publicationId }
  );
  if (!issue) return null;
  const normalized = {
    ...issue,
    coverOverrides: issue.coverOverrides
      ? {
          leadPostSlug: issue.coverOverrides.leadPostSlug,
          secondaryPostSlugs: (issue.coverOverrides.secondaryPostSlugs || []).map((s: any) =>
            typeof s === 'string' ? s : s?.value
          ),
        }
      : undefined,
  };
  return {
    id: issue.issueSlug,
    collection: 'issues',
    data: normalized,
  };
}

export async function getIssuesForPublication(publicationId: string) {
  if (!useCms) return local.getIssuesForPublication(publicationId);
  const issues = await client!.fetch(
    groq`*[_type=="issue" && publication->id==$pub]{..., "publicationId":publication->id} | order(date desc)`,
    { pub: publicationId }
  );
  return issues.map((issue: any) => ({
    id: issue.issueSlug,
    collection: 'issues',
      data: {
        ...issue,
        coverOverrides: issue.coverOverrides
          ? {
              leadPostSlug: issue.coverOverrides.leadPostSlug,
              secondaryPostSlugs: (issue.coverOverrides.secondaryPostSlugs || []).map((s: any) =>
                typeof s === 'string' ? s : s?.value
              ),
            }
          : undefined,
      },
  }));
}

export async function getPostsForIssue(publicationId: string, issueSlug: string) {
  if (!useCms) return local.getPostsForIssue(publicationId, issueSlug);
  const posts: CmsPost[] = await client!.fetch(
    groq`${postQuery}[_type=="post" && publication->id==$pub && issueSlug==$slug]{..., "publicationId":publication->id, "slug": slug.current}`,
    { pub: publicationId, slug: issueSlug }
  );
  return posts
    .map((p) => ({
      id: p.slug,
      collection: 'posts',
      data: {
        ...p,
        slug: p.slug,
        publicationId,
        tags: p.tags || [],
      },
      readingTimeMinutes: Math.max(1, Math.round(readingTime(textFromPortable(p.body)).minutes)),
    }))
    .sort((a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime());
}

export async function getLatestLockedIssueForPublication(publicationId: string) {
  if (!useCms) return local.getLatestLockedIssueForPublication(publicationId);
  const issue = await client!.fetch(
    groq`*[_type=="issue" && publication->id==$pub && status=="locked"]{..., "publicationId":publication->id} | order(date desc)[0]`,
    { pub: publicationId }
  );
  return issue ? { id: issue.issueSlug, collection: 'issues', data: issue } : null;
}

export async function getLatestIssues(limit = 6) {
  if (!useCms) return local.getLatestIssues(limit);
  const issues = await client!.fetch(
    groq`*[_type=="issue" && status=="locked"]{..., "publicationId":publication->id} | order(date desc)[0...$limit]`,
    { limit }
  );
  return issues.map((issue: any) => ({ id: issue.issueSlug, collection: 'issues', data: issue }));
}

export async function getLatestPosts(limit = 12) {
  if (!useCms) return local.getLatestPosts(limit);
  const posts: CmsPost[] = await client!.fetch(
    groq`${postQuery}{..., "publicationId":publication->id, "slug": slug.current} | order(publishedAt desc)[0...$limit]`,
    { limit }
  );
  return posts.map((p) => ({
    id: p.slug,
    collection: 'posts',
    data: { ...p, slug: p.slug, tags: p.tags || [] },
    readingTimeMinutes: Math.max(1, Math.round(readingTime(textFromPortable(p.body)).minutes)),
  }));
}

export async function getPostsByPublication(publicationId: string) {
  if (!useCms) return local.getPostsByPublication(publicationId);
  const posts: CmsPost[] = await client!.fetch(
    groq`${postQuery}[publication->id==$pub]{..., "publicationId":publication->id, "slug": slug.current} | order(publishedAt desc)`,
    { pub: publicationId }
  );
  return posts.map((p) => ({
    id: p.slug,
    collection: 'posts',
    data: { ...p, slug: p.slug, tags: p.tags || [] },
    readingTimeMinutes: Math.max(1, Math.round(readingTime(p.body ? JSON.stringify(p.body) : '').minutes)),
  }));
}

export async function getPostBySlug(slug: string, { includeDraft = false } = {}) {
  if (!useCms || (!includeDraft && !client)) return local.getPostBySlug(slug);
  const fetcher = includeDraft && previewClient ? previewClient : client!;
  const query = includeDraft
    ? groq`*[_type=="post" && slug.current==$slug] | order(_updatedAt desc)[0]{..., "publicationId":publication->id, "slug": slug.current}`
    : groq`${postQuery}[slug.current==$slug][0]{..., "publicationId":publication->id, "slug": slug.current}`;
  const post: CmsPost | null = await fetcher.fetch(query, { slug });
  return post
    ? {
        id: post.slug,
        collection: 'posts',
        data: { ...post, slug: post.slug },
        readingTimeMinutes: Math.max(1, Math.round(readingTime(textFromPortable(post.body)).minutes)),
      }
    : null;
}
