import type { CollectionEntry } from "astro:content";

export type PublicationEntry = CollectionEntry<"publications">;
export type IssueEntry = CollectionEntry<"issues">;
export type PostEntry = CollectionEntry<"posts">;

export type Publication = PublicationEntry["data"] & { id: string };

export interface Issue {
  /** Collection entry id, used for stable keys. */
  key: string;
  publicationId: string;
  slug: string;
  title: string;
  volume: number;
  number: number;
  date: string;
  status: "open" | "locked";
  editorNote?: string;
  coverDek?: string;
  coverLines?: string[];
  price: string;
}

export interface Post {
  id: string;
  publicationId: string;
  issueSlug?: string;
  section: string;
  format: PostEntry["data"]["format"];
  difficulty: PostEntry["data"]["difficulty"];
  publishedAt: string;
  headline: string;
  dek: string;
  summary: string;
  tags: string[];
  order: number;
  coverPriority: number;
  readingMinutes: number;
  entry: PostEntry;
}

/** An issue bundled with everything needed to draw it on the rack. */
export interface RackItem {
  issue: Issue;
  publication: Publication;
  posts: Post[];
}
