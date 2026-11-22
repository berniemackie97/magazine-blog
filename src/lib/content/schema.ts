import { z } from "astro/zod";
import {
  coverTemplates,
  themeFonts,
  articleFormats,
  readingLevels,
} from "./constants";
export { coverTemplates, themeFonts } from "./constants";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color like #1f7a8c");

export const isoDate = z.string().date("Expected an ISO date (YYYY-MM-DD)");

export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a kebab-case slug");

export const publicationsSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    kicker: z.string().min(1),
    accent: hexColor,
    /** Accent that passes 4.5:1 on light paper (newsprint, notes). */
    paperAccent: hexColor,
    featured: z.boolean().default(false),
    sections: z.array(z.object({ id: slug, label: z.string().min(1) })).min(1),
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
  })
  .strict();

export const issuesSchema = z
  .object({
    publication: slug,
    slug,
    title: z.string().min(1),
    volume: z.number().int().nonnegative(),
    number: z.number().int().positive(),
    date: isoDate,
    visibility: z.enum(["public", "draft"]).default("public"),
    status: z.enum(["open", "locked"]),
    editorNote: z.string().optional(),
    coverDek: z.string().optional(),
    coverLines: z.array(z.string().min(1)).max(4).optional(),
    price: z.string().default("Free"),
  })
  .strict();

export const postsSchema = z
  .object({
    publication: slug,
    issue: slug.optional(),
    section: slug,
    format: z.enum(articleFormats),
    difficulty: z.enum(readingLevels),
    publishedAt: isoDate,
    updatedAt: isoDate.optional(),
    headline: z.string().min(1),
    dek: z.string().min(1),
    summary: z.string().default(""),
    tags: z.array(slug).default([]),
    draft: z.boolean().default(false),
    order: z.number().int().default(0),
    coverPriority: z.number().int().default(0),
  })
  .strict();
