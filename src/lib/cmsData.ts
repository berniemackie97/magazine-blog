import groq from "groq";
import readingTime from "reading-time";
import { client, previewClient } from "./cmsClient";
import * as local from "./data";
import type {
  IssueRecord,
  PostRecord,
  PublicationRecord,
  PublicationData,
  IssueData,
  PostData,
  CoverSpec,
  CoverLayout,
  CoverTheme,
  CoverBlock,
  CoverFeatureItem,
} from "./contentTypes";

const useCms = Boolean(client);

function textFromPortable(body: any[] | undefined): string {
  if (!body) return "";
  return body
    .map((block) => {
      if (block?._type === "block" && Array.isArray(block.children)) {
        return block.children.map((c: any) => c?.text ?? "").join(" ");
      }
      if (block?._type === "pullQuote" && block.quote)
        return String(block.quote);
      if (block?._type === "sidebar" && block.body)
        return textFromPortable(block.body);
      return "";
    })
    .join(" ");
}

type CmsPublication = PublicationData;

type CmsPost = {
  slug: string;
  publicationId: string;
  issueSlug?: string;
  sectionId: string;
  format: PostData["format"];
  difficulty: PostData["difficulty"];
  publishedAt: string;
  updatedAt?: string;
  headline: string;
  dek: string;
  summary: string;
  tags?: string[];
  draft?: boolean;
  coverSlot?: PostData["coverSlot"];
  coverPriority?: number;
  heroImage?: unknown;
  heroAlt?: string;
  body?: any;
};

const postQuery = groq`*[_type=="post" && (!draft || draft==false)]`;

function normalizeTheme(raw: any): CoverTheme | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const theme: CoverTheme = {};
  if (typeof raw.paper === "string") theme.paper = raw.paper;
  if (typeof raw.ink === "string") theme.ink = raw.ink;
  if (typeof raw.accent === "string") theme.accent = raw.accent;
  if (typeof raw.alt === "string") theme.alt = raw.alt;
  if (typeof raw.photo === "string") theme.photo = raw.photo;
  if (typeof raw.tilt === "string") theme.tilt = raw.tilt;

  return Object.keys(theme).length ? theme : undefined;
}

function normalizeLayout(raw: any): CoverLayout {
  const cols = typeof raw?.cols === "string" ? raw.cols : "1fr";
  const rows = typeof raw?.rows === "string" ? raw.rows : undefined;

  const areasRaw = Array.isArray(raw?.areas) ? raw.areas : [];
  const areas = areasRaw
    .map((row: any) => (typeof row === "string" ? row : String(row ?? "")))
    .filter(Boolean);

  const gap = typeof raw?.gap === "string" ? raw.gap : undefined;
  const pad = typeof raw?.pad === "string" ? raw.pad : undefined;
  const minHeight =
    typeof raw?.minHeight === "number" ? raw.minHeight : undefined;

  return {
    cols,
    rows,
    areas: areas.length ? areas : ["title"],
    gap,
    pad,
    minHeight,
  };
}

function normalizeFeatureItems(raw: any): CoverFeatureItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any) => {
      if (!it || typeof it !== "object") return null;
      const text = typeof it.text === "string" ? it.text : "";
      if (!text) return null;
      const no = typeof it.no === "string" ? it.no : undefined;
      return { no, text } satisfies CoverFeatureItem;
    })
    .filter(Boolean) as CoverFeatureItem[];
}

function normalizeBlocks(raw: any): CoverBlock[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((b: any, idx: number) => {
      if (!b || typeof b !== "object") return null;

      const type = String(b.type ?? b._type ?? "");
      const area = typeof b.area === "string" ? b.area : "";

      if (!type || !area) return null;

      const base: any = {
        id:
          typeof b.id === "string"
            ? b.id
            : typeof b._key === "string"
              ? b._key
              : `${type}-${idx}`,
        type,
        area,
        tone: typeof b.tone === "string" ? b.tone : undefined,
        rotate: typeof b.rotate === "number" ? b.rotate : undefined,
        align: typeof b.align === "string" ? b.align : undefined,
        hidden: Boolean(b.hidden),
      };

      // Type-specific payload
      switch (type) {
        case "masthead":
          return {
            ...base,
            type: "masthead",
            publicationName: String(b.publicationName ?? ""),
            statusText:
              typeof b.statusText === "string" ? b.statusText : undefined,
          } satisfies CoverBlock;

        case "title":
          return {
            ...base,
            type: "title",
            title: String(b.title ?? ""),
            dek: typeof b.dek === "string" ? b.dek : undefined,
          } satisfies CoverBlock;

        case "meta":
          return {
            ...base,
            type: "meta",
            left: typeof b.left === "string" ? b.left : undefined,
            right: typeof b.right === "string" ? b.right : undefined,
            price: typeof b.price === "string" ? b.price : undefined,
          } satisfies CoverBlock;

        case "art":
          return {
            ...base,
            type: "art",
            background:
              typeof b.background === "string" ? b.background : undefined,
          } satisfies CoverBlock;

        case "featureList":
          return {
            ...base,
            type: "featureList",
            heading: typeof b.heading === "string" ? b.heading : undefined,
            hint: typeof b.hint === "string" ? b.hint : undefined,
            items: normalizeFeatureItems(b.items),
          } satisfies CoverBlock;

        case "sticker":
          return {
            ...base,
            type: "sticker",
            big: String(b.big ?? ""),
            small: typeof b.small === "string" ? b.small : undefined,
          } satisfies CoverBlock;

        case "barcode":
          return {
            ...base,
            type: "barcode",
          } satisfies CoverBlock;

        case "cta":
          return {
            ...base,
            type: "cta",
            text: String(b.text ?? ""),
          } satisfies CoverBlock;

        case "spine":
          return {
            ...base,
            type: "spine",
            text: String(b.text ?? ""),
          } satisfies CoverBlock;

        default:
          return null;
      }
    })
    .filter(Boolean) as CoverBlock[];
}

function fallbackCoverSpec(issueTitle: string): CoverSpec {
  return {
    template: "classic",
    layout: {
      cols: "1fr",
      areas: ["title"],
      minHeight: 520,
      pad: "12px 12px 12px 42px",
    },
    blocks: [
      {
        id: "title",
        type: "title",
        area: "title",
        title: issueTitle || "Untitled issue",
      },
    ],
  };
}

function normalizeCoverSpec(raw: any, issueTitle: string): CoverSpec {
  if (!raw || typeof raw !== "object") return fallbackCoverSpec(issueTitle);

  const template =
    typeof raw.template === "string" && raw.template.trim()
      ? raw.template.trim()
      : "classic";
  const theme = normalizeTheme(raw.theme);
  const layout = normalizeLayout(raw.layout);
  const blocks = normalizeBlocks(raw.blocks);

  if (!blocks.length) return fallbackCoverSpec(issueTitle);

  return {
    template,
    theme,
    layout,
    blocks,
  };
}

function normalizeIssue(raw: any): IssueData {
  const displayTitle = String(raw.displayTitle ?? "");

  return {
    publicationId: raw.publicationId,
    issueSlug: raw.issueSlug,
    displayTitle,
    volume: raw.volume,
    number: raw.number,
    date: raw.date,
    theme: raw.theme,
    status: raw.status,
    notesFromEditor: raw.notesFromEditor,
    coverSpec: normalizeCoverSpec(raw.coverSpec, displayTitle),
  };
}

export async function getPublications(): Promise<PublicationRecord[]> {
  if (!useCms) return local.getPublications();

  const pubs: CmsPublication[] = await client!.fetch(
    groq`*[_type=="publication"]{...}`,
  );
  return pubs.map((p) => ({ id: p.id, data: p }));
}

export async function getFeaturedPublications(): Promise<PublicationRecord[]> {
  if (!useCms) return local.getFeaturedPublications();

  const pubs: CmsPublication[] = await client!.fetch(
    groq`*[_type=="publication" && isFeatured==true]{...}`,
  );

  return pubs.map((p) => ({ id: p.id, data: p }));
}

export async function getPublication(
  id: string,
): Promise<PublicationRecord | null> {
  if (!useCms) return local.getPublication(id);

  const pub: CmsPublication | null = await client!.fetch(
    groq`*[_type=="publication" && id==$id][0]{...}`,
    { id },
  );

  return pub ? { id: pub.id, data: pub } : null;
}

export async function getIssue(
  publicationId: string,
  issueSlug: string,
): Promise<IssueRecord | null> {
  if (!useCms) return local.getIssue(publicationId, issueSlug);

  const raw = await client!.fetch(
    groq`*[_type=="issue" && issueSlug==$slug && publication->id==$pub][0]{..., "publicationId":publication->id}`,
    { slug: issueSlug, pub: publicationId },
  );

  if (!raw) return null;

  const data = normalizeIssue(raw);
  return { id: data.issueSlug, data };
}

export async function getIssuesForPublication(
  publicationId: string,
): Promise<IssueRecord[]> {
  if (!useCms) return local.getIssuesForPublication(publicationId);

  const raws = await client!.fetch(
    groq`*[_type=="issue" && publication->id==$pub]{..., "publicationId":publication->id} | order(date desc)`,
    { pub: publicationId },
  );

  return raws.map((raw: any) => {
    const data = normalizeIssue(raw);
    return { id: data.issueSlug, data };
  });
}

export async function getPostsForIssue(
  publicationId: string,
  issueSlug: string,
): Promise<PostRecord[]> {
  if (!useCms) return local.getPostsForIssue(publicationId, issueSlug);

  const posts: CmsPost[] = await client!.fetch(
    groq`${postQuery}[publication->id==$pub && issueSlug==$slug]{..., "publicationId":publication->id, "slug": slug.current}`,
    { pub: publicationId, slug: issueSlug },
  );

  return posts
    .map((p) => {
      const bodyText = textFromPortable(p.body);
      return {
        id: p.slug,
        slug: p.slug,
        data: {
          publicationId: p.publicationId,
          issueSlug: p.issueSlug,
          sectionId: p.sectionId,
          format: p.format,
          difficulty: p.difficulty,
          publishedAt: p.publishedAt,
          updatedAt: p.updatedAt,
          headline: p.headline,
          dek: p.dek,
          summary: p.summary,
          tags: p.tags ?? [],
          draft: Boolean(p.draft),
          coverSlot: p.coverSlot,
          coverPriority: p.coverPriority,
          heroImage: p.heroImage,
          heroAlt: p.heroAlt,
        },
        readingTimeMinutes: Math.max(
          1,
          Math.round(readingTime(bodyText).minutes),
        ),
      } satisfies PostRecord;
    })
    .sort(
      (a, b) => Date.parse(b.data.publishedAt) - Date.parse(a.data.publishedAt),
    );
}

export async function getLatestLockedIssueForPublication(
  publicationId: string,
): Promise<IssueRecord | null> {
  if (!useCms) return local.getLatestLockedIssueForPublication(publicationId);

  const raw = await client!.fetch(
    groq`*[_type=="issue" && publication->id==$pub && status=="locked"]{..., "publicationId":publication->id} | order(date desc)[0]`,
    { pub: publicationId },
  );

  if (!raw) return null;
  const data = normalizeIssue(raw);
  return { id: data.issueSlug, data };
}

export async function getLatestIssues(limit = 6): Promise<IssueRecord[]> {
  if (!useCms) return local.getLatestIssues(limit);

  const raws = await client!.fetch(
    groq`*[_type=="issue" && status=="locked"]{..., "publicationId":publication->id} | order(date desc)[0...$limit]`,
    { limit },
  );

  return raws.map((raw: any) => {
    const data = normalizeIssue(raw);
    return { id: data.issueSlug, data };
  });
}

export async function getLatestPosts(limit = 12): Promise<PostRecord[]> {
  if (!useCms) return local.getLatestPosts(limit);

  const posts: CmsPost[] = await client!.fetch(
    groq`${postQuery}{..., "publicationId":publication->id, "slug": slug.current} | order(publishedAt desc)[0...$limit]`,
    { limit },
  );

  return posts.map((p) => {
    const bodyText = textFromPortable(p.body);
    return {
      id: p.slug,
      slug: p.slug,
      data: {
        publicationId: p.publicationId,
        issueSlug: p.issueSlug,
        sectionId: p.sectionId,
        format: p.format,
        difficulty: p.difficulty,
        publishedAt: p.publishedAt,
        updatedAt: p.updatedAt,
        headline: p.headline,
        dek: p.dek,
        summary: p.summary,
        tags: p.tags ?? [],
        draft: Boolean(p.draft),
        coverSlot: p.coverSlot,
        coverPriority: p.coverPriority,
        heroImage: p.heroImage,
        heroAlt: p.heroAlt,
      },
      readingTimeMinutes: Math.max(
        1,
        Math.round(readingTime(bodyText).minutes),
      ),
    };
  });
}

export async function getPostsByPublication(
  publicationId: string,
): Promise<PostRecord[]> {
  if (!useCms) return local.getPostsByPublication(publicationId);

  const posts: CmsPost[] = await client!.fetch(
    groq`${postQuery}[publication->id==$pub]{..., "publicationId":publication->id, "slug": slug.current} | order(publishedAt desc)`,
    { pub: publicationId },
  );

  return posts.map((p) => {
    const bodyText = textFromPortable(p.body);
    return {
      id: p.slug,
      slug: p.slug,
      data: {
        publicationId: p.publicationId,
        issueSlug: p.issueSlug,
        sectionId: p.sectionId,
        format: p.format,
        difficulty: p.difficulty,
        publishedAt: p.publishedAt,
        updatedAt: p.updatedAt,
        headline: p.headline,
        dek: p.dek,
        summary: p.summary,
        tags: p.tags ?? [],
        draft: Boolean(p.draft),
        coverSlot: p.coverSlot,
        coverPriority: p.coverPriority,
        heroImage: p.heroImage,
        heroAlt: p.heroAlt,
      },
      readingTimeMinutes: Math.max(
        1,
        Math.round(readingTime(bodyText).minutes),
      ),
    };
  });
}

export async function getPostBySlug(
  slug: string,
  { includeDraft = false }: { includeDraft?: boolean } = {},
): Promise<PostRecord | null> {
  if (!useCms) return local.getPostBySlug(slug);

  const fetcher = includeDraft && previewClient ? previewClient : client!;
  const query = includeDraft
    ? groq`*[_type=="post" && slug.current==$slug] | order(_updatedAt desc)[0]{..., "publicationId":publication->id, "slug": slug.current}`
    : groq`${postQuery}[slug.current==$slug][0]{..., "publicationId":publication->id, "slug": slug.current}`;

  const post: CmsPost | null = await fetcher.fetch(query, { slug });
  if (!post) return null;

  const bodyText = textFromPortable(post.body);

  return {
    id: post.slug,
    slug: post.slug,
    data: {
      publicationId: post.publicationId,
      issueSlug: post.issueSlug,
      sectionId: post.sectionId,
      format: post.format,
      difficulty: post.difficulty,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      headline: post.headline,
      dek: post.dek,
      summary: post.summary,
      tags: post.tags ?? [],
      draft: Boolean(post.draft),
      coverSlot: post.coverSlot,
      coverPriority: post.coverPriority,
      heroImage: post.heroImage,
      heroAlt: post.heroAlt,
    },
    readingTimeMinutes: Math.max(1, Math.round(readingTime(bodyText).minutes)),
  };
}
