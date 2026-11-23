import { z } from "astro/zod";
import { safeUrl } from "./links";
const text = z.string();
const url = text.refine(
  safeUrl,
  "Use an HTTP, HTTPS, mail, telephone, or relative URL.",
);
export const componentSchemas = {
  Callout: z
    .object({
      title: text.optional(),
      checklist: z.boolean().optional(),
      items: z.array(text).optional(),
    })
    .strict(),
  PullQuote: z.object({}).strict(),
  ResourceGrid: z.object({}).strict(),
  ResourceCard: z
    .object({
      title: text.min(1),
      href: url,
      summary: text.optional(),
      badge: text.optional(),
      tone: z.enum(["free", "paid", "freemium", "hardware"]).optional(),
      meta: text.optional(),
      tags: z.array(text).optional(),
      altSources: z
        .array(
          z.object({ label: text, href: url, note: text.optional() }).strict(),
        )
        .optional(),
    })
    .strict(),
  CollapsibleSection: z
    .object({
      title: text.min(1),
      subtitle: text.optional(),
      label: text.optional(),
      open: z.boolean().optional(),
      id: text.optional(),
    })
    .strict(),
  CaptionedFigure: z
    .object({
      src: url,
      alt: text.min(1),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
    })
    .strict(),
  CaptionedVideo: z
    .object({
      src: url.optional(),
      title: text.optional(),
      caption: text.optional(),
      poster: url.optional(),
      placeholder: text.optional(),
    })
    .strict(),
};
export type ComponentProps<K extends keyof typeof componentSchemas> = z.infer<
  (typeof componentSchemas)[K]
>;
