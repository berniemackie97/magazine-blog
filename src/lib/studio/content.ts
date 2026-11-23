import { createHash } from "node:crypto";
import { parseDocument, stringify } from "yaml";
import { z } from "astro/zod";
import {
  issuesSchema,
  postsSchema,
  publicationsSchema,
  slug,
} from "../content/schema";

export const collections = ["posts", "issues", "publications"] as const;
export type Collection = (typeof collections)[number];
export type Fields = Record<string, unknown>;
export interface Entry {
  collection: Collection;
  id: string;
  data: Fields;
  body: string;
  revision: string;
}
export interface Snapshot {
  revision: string;
  files: Record<string, string>;
  media: string[];
}
export interface Library {
  revision: string;
  entries: Entry[];
  media: string[];
}
export class StudioError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const entryInput = z
  .object({
    collection: z.enum(collections),
    id: slug,
    data: z.record(z.string(), z.unknown()),
    body: z.string().max(1_000_000).default(""),
    revision: z.string(),
  })
  .strict();
export const schemas = {
  posts: postsSchema,
  issues: issuesSchema,
  publications: publicationsSchema,
};
export function entryPath(collection: Collection, id: string): string {
  slug.parse(id);
  return `src/content/${collection}/${id}.${collection === "posts" ? "mdx" : "json"}`;
}
export function isContentPath(path: string): boolean {
  return /^src\/content\/(posts\/[a-z0-9]+(?:-[a-z0-9]+)*\.mdx|(?:issues|publications)\/[a-z0-9]+(?:-[a-z0-9]+)*\.json)$/.test(
    path,
  );
}
export function isMediaPath(path: string): boolean {
  return (
    /^public\/(?:images|media)\/[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(
      path,
    ) && !path.includes("..")
  );
}
export function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
export function decode(path: string, source: string): Entry {
  if (!isContentPath(path))
    throw new StudioError(400, "Unsupported content path.");
  const [, , collection, filename] = path.split("/");
  const id = filename!.replace(/\.(mdx|json)$/, "");
  let data: Fields;
  let body = "";
  if (collection === "posts") {
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
    if (!match)
      throw new StudioError(422, `${path}: article frontmatter is missing.`);
    const document = parseDocument(match[1]!, { uniqueKeys: true });
    if (document.errors.length)
      throw new StudioError(422, `${path}: ${document.errors[0]!.message}`);
    data = document.toJS({ maxAliasCount: 0 }) as Fields;
    body = source.slice(match[0].length);
  } else data = JSON.parse(source) as Fields;
  return {
    collection: collection as Collection,
    id,
    data: schemas[collection as Collection].parse(data),
    body,
    revision: hash(source),
  };
}
export function encode(
  entry: Pick<Entry, "collection" | "data" | "body">,
): string {
  const data = schemas[entry.collection].parse(entry.data);
  return entry.collection === "posts"
    ? `---\n${stringify(data, { lineWidth: 0, defaultStringType: "QUOTE_DOUBLE" })}---\n${entry.body}`
    : `${JSON.stringify(data, null, 2)}\n`;
}
export function library(snapshot: Snapshot): Library {
  return {
    revision: snapshot.revision,
    entries: Object.entries(snapshot.files).map(([path, source]) =>
      decode(path, source),
    ),
    media: snapshot.media,
  };
}
export function validateLibrary(entries: Entry[]): void {
  const publications = new Map(
    entries
      .filter((e) => e.collection === "publications")
      .map((e) => [e.id, e]),
  );
  const issues = entries.filter((e) => e.collection === "issues");
  const keys = new Set<string>();
  for (const issue of issues) {
    const key = `${issue.data.publication}/${issue.data.slug}`;
    if (keys.has(key))
      throw new StudioError(422, `Duplicate issue URL: ${key}.`);
    keys.add(key);
  }
  for (const entry of entries.filter((e) => e.collection !== "publications")) {
    const publication = publications.get(String(entry.data.publication));
    if (!publication)
      throw new StudioError(
        422,
        `${entry.id}: choose an existing publication.`,
      );
    if (entry.collection === "posts") {
      const sections = publication.data.sections as { id: string }[];
      if (!sections.some((s) => s.id === entry.data.section))
        throw new StudioError(
          422,
          `Article "${entry.data.headline}" (${entry.id}) uses section "${entry.data.section}" in publication "${publication.data.name}". Restore that section, or move the article to an existing section and save it before removing the section or changing its ID.`,
        );
      if (
        entry.data.issue &&
        !keys.has(`${entry.data.publication}/${entry.data.issue}`)
      )
        throw new StudioError(
          422,
          `${entry.id}: issue does not belong to this publication.`,
        );
    }
  }
}
export function assertRevision(actual: string, expected: string): void {
  if (actual !== expected)
    throw new StudioError(
      409,
      "Content changed since you opened it. Your edits are preserved. Reload the current version before saving again.",
    );
}
