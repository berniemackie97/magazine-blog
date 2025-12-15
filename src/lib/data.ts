import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import readingTime from 'reading-time';

type PostEntry = CollectionEntry<'posts'>;
type IssueEntry = CollectionEntry<'issues'>;

const isLocked = (issue: IssueEntry) => issue.data.status === 'locked';

function withReadingTime(entry: PostEntry) {
  const stats = readingTime(entry.body);
  return { ...entry, readingTimeMinutes: Math.max(1, Math.round(stats.minutes)) };
}

export async function getPublication(id: string) {
  const entry = await getEntry('publications', id);
  return entry;
}

export async function getIssue(publicationId: string, issueSlug: string) {
  const issues = await getCollection('issues');
  return issues.find((issue) => issue.data.publicationId === publicationId && issue.data.issueSlug === issueSlug);
}

export async function getIssuesForPublication(publicationId: string) {
  const issues = await getCollection('issues');
  return issues
    .filter((issue) => issue.data.publicationId === publicationId)
    .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
}

export async function getPostsForIssue(publicationId: string, issueSlug: string) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts
    .filter((post) => post.data.publicationId === publicationId && post.data.issueSlug === issueSlug)
    .map(withReadingTime)
    .sort((a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime());
}

export async function getLatestLockedIssueForPublication(publicationId: string) {
  const issues = await getCollection('issues');
  return issues
    .filter((issue) => issue.data.publicationId === publicationId && isLocked(issue))
    .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())[0];
}

export async function getLatestIssues(limit = 6) {
  const issues = await getCollection('issues');
  return issues
    .filter(isLocked)
    .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
    .slice(0, limit);
}

export async function getLatestPosts(limit = 12) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts
    .map(withReadingTime)
    .sort((a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime())
    .slice(0, limit);
}

export async function getPostsByPublication(publicationId: string) {
  const posts = await getCollection('posts', ({ data }) => !data.draft && data.publicationId === publicationId);
  return posts
    .map(withReadingTime)
    .sort((a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime());
}
