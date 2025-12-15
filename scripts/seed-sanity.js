import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { createClient } from '@sanity/client';
import crypto from 'crypto';

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || 'production';
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !token) {
  console.error('Missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN in environment.');
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

const root = process.cwd();
const publicationsDir = path.join(root, 'src', 'content', 'publications');
const issuesDir = path.join(root, 'src', 'content', 'issues');
const postsDir = path.join(root, 'src', 'content', 'posts');

function toBlocks(rawContent) {
  const withoutImports = rawContent
    .split('\n')
    .filter((line) => !line.trim().startsWith('import '))
    .join('\n')
    .trim();
  const paragraphs = withoutImports.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];
  return paragraphs.map((text) => ({
    _type: 'block',
    _key: crypto.randomUUID(),
    style: 'normal',
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: crypto.randomUUID(),
        text,
        marks: [],
      },
    ],
  }));
}

async function loadPublications() {
  const files = fs.readdirSync(publicationsDir).filter((f) => f.endsWith('.json'));
  return files.map((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(publicationsDir, file), 'utf-8'));
    return {
      _id: `publication.${data.id}`,
      _type: 'publication',
      ...data,
      sections: (data.sections || []).map((s) => ({ _key: crypto.randomUUID(), ...s })),
    };
  });
}

async function loadIssues() {
  const files = fs.readdirSync(issuesDir).filter((f) => f.endsWith('.json'));
  return files.map((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(issuesDir, file), 'utf-8'));
    return {
      _id: `issue.${data.publicationId}.${data.issueSlug}`,
      _type: 'issue',
      issueSlug: data.issueSlug,
      displayTitle: data.displayTitle,
      volume: data.volume,
      number: data.number,
      date: data.date,
      theme: data.theme,
      status: data.status,
      notesFromEditor: data.notesFromEditor,
      coverOverrides: data.coverOverrides
        ? {
            leadPostSlug: data.coverOverrides.leadPostSlug,
            secondaryPostSlugs: (data.coverOverrides.secondaryPostSlugs || []).map((s) => s),
          }
        : undefined,
      publication: { _type: 'reference', _ref: `publication.${data.publicationId}` },
      coverImageUrl: data.coverImageUrl,
    };
  });
}

async function loadPosts() {
  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.mdx'));
  return files.map((file) => {
    const slug = file.replace(/\.mdx$/, '');
    const raw = fs.readFileSync(path.join(postsDir, file), 'utf-8');
    const { data, content } = matter(raw);
    return {
      _id: `post.${slug}`,
      _type: 'post',
      slug: { _type: 'slug', current: slug },
      headline: data.headline,
      publication: { _type: 'reference', _ref: `publication.${data.publicationId}` },
      issueSlug: data.issueSlug,
      issue: data.issueSlug ? { _type: 'reference', _ref: `issue.${data.publicationId}.${data.issueSlug}` } : undefined,
      sectionId: data.sectionId,
      format: data.format,
      difficulty: data.difficulty,
      publishedAt: data.publishedAt,
      updatedAt: data.updatedAt,
      dek: data.dek,
      summary: data.summary,
      tags: (data.tags || []).map((t) => t),
      draft: data.draft || false,
      coverSlot: data.coverSlot,
      coverPriority: data.coverPriority,
      coverImageUrl: data.heroImage || data.coverImageUrl,
      body: toBlocks(content),
    };
  });
}

async function run() {
  const pubs = await loadPublications();
  const issues = await loadIssues();
  const posts = await loadPosts();

  console.log(`Importing ${pubs.length} publications, ${issues.length} issues, ${posts.length} posts...`);

  const tx = client.transaction();
  pubs.forEach((doc) => tx.createOrReplace(doc));
  issues.forEach((doc) => tx.createOrReplace(doc));
  posts.forEach((doc) => tx.createOrReplace(doc));
  await tx.commit();
  console.log('Import complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
