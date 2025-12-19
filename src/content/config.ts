import { defineCollection, z } from "astro:content";

// Cover specification schemas - matching Sanity structure
const coverThemeSchema = z.object({
  paper: z.string().optional(),
  ink: z.string().optional(),
  accent: z.string().optional(),
  alt: z.string().optional(),
  photo: z.string().optional(),
  tilt: z.string().optional(),
}).optional();

const coverLayoutSchema = z.object({
  cols: z.string(),
  rows: z.string().optional(),
  areas: z.array(z.string()).optional(),
  gap: z.string().optional(),
  pad: z.string().optional(),
  minHeight: z.number().optional(),
}).optional();

const coverFeatureItemSchema = z.object({
  no: z.string().optional(),
  text: z.string(),
});

const coverBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['masthead', 'title', 'meta', 'art', 'featureList', 'sticker', 'barcode', 'cta', 'spine']),
  area: z.string(),
  tone: z.enum(['paper', 'ink', 'muted', 'accent']).optional(),
  rotate: z.number().optional(),
  align: z.enum(['start', 'center', 'end']).optional(),
  hidden: z.boolean().optional(),
  // Type-specific fields
  publicationName: z.string().optional(),
  statusText: z.string().optional(),
  title: z.string().optional(),
  dek: z.string().optional(),
  left: z.string().optional(),
  right: z.string().optional(),
  price: z.string().optional(),
  background: z.string().optional(),
  heading: z.string().optional(),
  hint: z.string().optional(),
  items: z.array(coverFeatureItemSchema).optional(),
  big: z.string().optional(),
  small: z.string().optional(),
  text: z.string().optional(),
});

const coverSpecSchema = z.object({
  template: z.string().default('bold-pop'),
  theme: coverThemeSchema,
  layout: coverLayoutSchema,
  blocks: z.array(coverBlockSchema).optional(),
}).optional();

const publications = defineCollection({
  type: "data",
  schema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    accent: z.string(),
    displayFont: z.string(),
    sections: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    ),
    isFeatured: z.boolean().default(false),
    defaultCoverSpec: coverSpecSchema,
  }),
});

const issues = defineCollection({
  type: "data",
  schema: z.object({
    publicationId: z.string(),
    issueSlug: z.string(),
    displayTitle: z.string(),
    volume: z.number(),
    number: z.number(),
    date: z.string(),
    theme: z.string(),
    status: z.enum(["open", "locked"]),
    notesFromEditor: z.string().optional(),
    coverImage: z.string().url().optional(),
    coverLines: z.array(z.string()).max(6).optional(),
    price: z.string().optional(),
    coverStatusLabel: z.string().optional(),
    coverOverrides: z
      .object({
        leadPostSlug: z.string().optional(),
        secondaryPostSlugs: z.array(z.string()).max(4).optional(),
      })
      .optional(),
    coverSpec: coverSpecSchema,
  }),
});

const posts = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      publicationId: z.string(),
      issueSlug: z.string().optional(),
      sectionId: z.string(),
      format: z.enum([
        "feature",
        "column",
        "brief",
        "field-notes",
        "postmortem",
        "tool-drop",
      ]),
      difficulty: z.enum(["beginner", "intermediate", "advanced", "all"]),
      publishedAt: z.string(),
      updatedAt: z.string().optional(),
      headline: z.string(),
      dek: z.string(),
      summary: z.string(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      coverSlot: z.enum(["lead", "secondary", "brief"]).optional(),
      coverPriority: z.number().optional(),
      heroImage: image().optional(),
      heroAlt: z.string().optional(),
    }),
});

export const collections = { publications, issues, posts };
