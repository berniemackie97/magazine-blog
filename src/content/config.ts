import { defineCollection, z } from "astro:content";

const coverTemplateId = z.enum(["ops-bulletin", "field-notes", "neon-pop"]);

const coverPalette = z
  .object({
    paper: z.string().optional(),
    ink: z.string().optional(),
    accent: z.string().optional(),
    alt: z.string().optional(),
  })
  .optional();

const publications = defineCollection({
  type: "data",
  schema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    accent: z.string(),
    displayFont: z.string(),
    coverTemplate: coverTemplateId.optional(),
    coverPalette,

    sections: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    ),
    isFeatured: z.boolean().default(false),
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
