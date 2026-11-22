import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color like #1f7a8c");

const isoDate = z.string().date("Expected an ISO date (YYYY-MM-DD)");

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a kebab-case slug");

/** Cover artwork style. Each value maps to one cover component. */
export const coverTemplates = ["tech-mono", "field-notes", "bold-pop"] as const;

/** Font families a publication may use for headings and body copy. */
export const themeFonts = ["display", "body", "mono", "hand"] as const;

const publications = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/publications" }),
  schema: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    kicker: z.string().min(1),
    accent: hexColor,
    /** Accent that passes 4.5:1 on light paper (newsprint, notes). */
    paperAccent: hexColor,
    featured: z.boolean().default(false),
    sections: z
      .array(z.object({ id: slug, label: z.string().min(1) }))
      .min(1),
    cover: z.object({
      template: z.enum(coverTemplates),
      paper: hexColor,
      ink: hexColor,
      accent: hexColor,
      spine: hexColor,
    }),
    theme: z.object({
      scheme: z.enum(["light", "dark"]),
      background: hexColor,
      surface: hexColor,
      text: hexColor,
      textMuted: hexColor,
      accent: hexColor,
      accentAlt: hexColor,
      border: hexColor,
      headingFont: z.enum(themeFonts),
      bodyFont: z.enum(themeFonts),
    }),
  }),
});

const issues = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/issues" }),
  schema: z.object({
    publication: reference("publications"),
    slug,
    title: z.string().min(1),
    volume: z.number().int().nonnegative(),
    number: z.number().int().positive(),
    date: isoDate,
    status: z.enum(["open", "locked"]),
    editorNote: z.string().optional(),
    coverDek: z.string().optional(),
    coverLines: z.array(z.string().min(1)).max(4).optional(),
    price: z.string().default("Free"),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: "*.mdx", base: "./src/content/posts" }),
  schema: z.object({
    publication: reference("publications"),
    issue: slug.optional(),
    section: slug,
    format: z.enum([
      "feature",
      "column",
      "brief",
      "field-notes",
      "postmortem",
      "tool-drop",
    ]),
    difficulty: z.enum(["beginner", "intermediate", "advanced", "all"]),
    publishedAt: isoDate,
    updatedAt: isoDate.optional(),
    headline: z.string().min(1),
    dek: z.string().min(1),
    summary: z.string().default(""),
    tags: z.array(slug).default([]),
    draft: z.boolean().default(false),
    coverPriority: z.number().int().default(0),
  }),
});

export const collections = { publications, issues, posts };
