import { getCollection } from "astro:content";
import { compareIsoDatesDesc } from "../dates";
import type { Issue, IssueEntry } from "./types";

function toIssue(entry: IssueEntry): Issue {
  const { publication, ...data } = entry.data;
  return { ...data, key: entry.id, publicationId: publication.id };
}

/** All issues, newest first. */
export async function getIssues(): Promise<Issue[]> {
  const entries = await getCollection("issues");
  const issues = entries.map(toIssue).sort((a, b) => compareIsoDatesDesc(a.date, b.date));
  assertUniqueSlugs(issues);
  return issues;
}

export async function getIssuesForPublication(publicationId: string): Promise<Issue[]> {
  return (await getIssues()).filter((i) => i.publicationId === publicationId);
}

export async function getLatestPublishedIssues(limit: number): Promise<Issue[]> {
  return (await getIssues()).filter((i) => i.status === "locked").slice(0, limit);
}

export async function findIssue(
  publicationId: string,
  slug: string,
): Promise<Issue | undefined> {
  return (await getIssues()).find(
    (i) => i.publicationId === publicationId && i.slug === slug,
  );
}

export function issueLabel(issue: Pick<Issue, "volume" | "number">): string {
  return `Vol. ${issue.volume} No. ${issue.number}`;
}

function assertUniqueSlugs(issues: Issue[]): void {
  const seen = new Set<string>();
  for (const issue of issues) {
    const id = `${issue.publicationId}/${issue.slug}`;
    if (seen.has(id)) throw new Error(`Duplicate issue slug "${id}"`);
    seen.add(id);
  }
}
