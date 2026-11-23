import {
  articleFormats,
  readingLevels,
  coverTemplates,
  themeFonts,
} from "../../lib/content/constants";
import type { Collection, Fields } from "../../lib/studio/content";
export interface Field {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "date"
    | "number"
    | "checkbox"
    | "select"
    | "color"
    | "tags"
    | "lines";
  options?: string[];
  help?: string;
  wide?: boolean;
  readonly?: boolean;
}
export const formats = [...articleFormats];
export const postFields: Field[] = [
  { key: "headline", label: "Headline", wide: true },
  {
    key: "dek",
    label: "Description",
    type: "textarea",
    wide: true,
    help: "The short introduction shown below the headline.",
  },
  { key: "publication", label: "Publication", type: "select" },
  {
    key: "issue",
    label: "Issue",
    type: "select",
    help: "Leave unassigned to publish a standalone article.",
  },
  { key: "section", label: "Section", type: "select" },
  { key: "format", label: "Article format", type: "select", options: formats },
  {
    key: "difficulty",
    label: "Reading level",
    type: "select",
    options: [...readingLevels],
  },
  {
    key: "publishedAt",
    label: "Publication date",
    type: "date",
    help: "A display date, not an automatic publishing schedule.",
  },
  { key: "updatedAt", label: "Updated date", type: "date" },
  {
    key: "tags",
    label: "Tags",
    type: "tags",
    help: "Comma separated. Use lowercase words separated by hyphens.",
  },
  {
    key: "summary",
    label: "Search and sharing summary",
    type: "textarea",
    wide: true,
  },
  {
    key: "order",
    label: "Article order",
    type: "number",
    help: "Lower numbers appear first in the issue.",
  },
  {
    key: "coverPriority",
    label: "Cover prominence",
    type: "number",
    help: "Higher numbers get priority for automatic cover lines.",
  },
  {
    key: "draft",
    label: "Keep this article unpublished",
    type: "checkbox",
    wide: true,
  },
];
export const issueFields: Field[] = [
  { key: "title", label: "Issue title", wide: true },
  { key: "publication", label: "Publication", type: "select" },
  {
    key: "slug",
    label: "Issue URL slug",
    readonly: true,
    help: "Stable issue URL, chosen when the issue is created.",
  },
  { key: "volume", label: "Volume", type: "number" },
  { key: "number", label: "Issue number", type: "number" },
  { key: "date", label: "Issue date", type: "date" },
  {
    key: "status",
    label: "Issue assembly",
    type: "select",
    options: ["open", "locked"],
    help: "Open issues appear as in progress. Locked issues show the finished cover.",
  },
  {
    key: "visibility",
    label: "Publication visibility",
    type: "select",
    options: ["draft", "public"],
    help: "Draft issues and their articles stay off the public site.",
  },
  { key: "price", label: "Cover price" },
  { key: "coverDek", label: "Cover description", type: "textarea", wide: true },
  {
    key: "coverLines",
    label: "Cover lines",
    type: "lines",
    wide: true,
    help: "One per line, up to four. Leave empty to select headlines automatically.",
  },
  { key: "editorNote", label: "From the editor", type: "textarea", wide: true },
];
export const publicationFields: Field[] = [
  { key: "name", label: "Publication name", wide: true },
  { key: "description", label: "Description", type: "textarea", wide: true },
  { key: "kicker", label: "Kicker" },
  { key: "accent", label: "Accent", type: "color" },
  {
    key: "paperAccent",
    label: "Accent on paper",
    type: "color",
    help: "Choose a dark color readable on light paper.",
  },
  {
    key: "featured",
    label: "Feature this publication on the rack",
    type: "checkbox",
  },
];
export const coverFields: Field[] = [
  {
    key: "cover.template",
    label: "Cover template",
    type: "select",
    options: [...coverTemplates],
  },
  ...["paper", "ink", "accent", "spine"].map((key) => ({
    key: `cover.${key}`,
    label: `Cover ${key}`,
    type: "color" as const,
  })),
];
export const themeFields: Field[] = [
  {
    key: "theme.scheme",
    label: "Color scheme",
    type: "select",
    options: ["light", "dark"],
  },
  ...[
    "background",
    "surface",
    "text",
    "textMuted",
    "accent",
    "accentAlt",
    "border",
  ].map((key) => ({
    key: `theme.${key}`,
    label: key.replace(/([A-Z])/g, " $1"),
    type: "color" as const,
  })),
  ...["headingFont", "bodyFont"].map((key) => ({
    key: `theme.${key}`,
    label: key === "headingFont" ? "Heading font" : "Body font",
    type: "select" as const,
    options: [...themeFonts],
  })),
];
export const today = () => new Date().toLocaleDateString("en-CA");
export function defaults(
  collection: Collection,
  publication?: string,
  section?: string,
): Fields {
  if (collection === "posts")
    return {
      headline: "Untitled article",
      dek: "A new story for the rack.",
      publication: publication ?? "",
      section: section ?? "",
      format: "feature",
      difficulty: "all",
      publishedAt: today(),
      tags: [],
      draft: true,
      order: 0,
      coverPriority: 0,
      summary: "",
    };
  if (collection === "issues")
    return {
      title: "Untitled issue",
      publication: publication ?? "",
      slug: "new-issue",
      volume: 1,
      number: 1,
      date: today(),
      status: "open",
      visibility: "draft",
      price: "Free",
    };
  return {
    name: "New publication",
    description: "Stories, guides, and experiments.",
    kicker: "Independent perspectives",
    accent: "#185b47",
    paperAccent: "#185b47",
    featured: false,
    sections: [{ id: "features", label: "Features" }],
    cover: {
      template: "field-notes",
      paper: "#f7f2e8",
      ink: "#252b29",
      accent: "#185b47",
      spine: "#185b47",
    },
    theme: {
      scheme: "light",
      background: "#f7f2e8",
      surface: "#ffffff",
      text: "#252b29",
      textMuted: "#58635b",
      accent: "#185b47",
      accentAlt: "#7c4933",
      border: "#c5ccbd",
      headingFont: "display",
      bodyFont: "body",
    },
  };
}
export const templates: Record<string, string> = {
  feature: "## The idea\n\n\n\n## How it works\n\n\n\n## What I learned\n\n",
  column: "## A thought worth sharing\n\n",
  brief: "",
  "field-notes":
    "## What I tried\n\n\n\n## What happened\n\n\n\n## Next experiment\n\n",
  postmortem:
    "## What happened\n\n\n\n## Impact\n\n\n\n## Cause\n\n\n\n## What changed\n\n",
  "tool-drop":
    "## What it does\n\n\n\n## Getting started\n\n```sh\n\n```\n\n## Links\n\n",
};
export interface Block {
  name: string;
  label: string;
  fields: Field[];
  children?: string;
}
export const blocks: Block[] = [
  {
    name: "Callout",
    label: "Callout note",
    fields: [{ key: "title", label: "Title" }],
    children: "Your note here.",
  },
  {
    name: "PullQuote",
    label: "Pull quote",
    fields: [],
    children: "A line worth remembering.",
  },
  {
    name: "CaptionedFigure",
    label: "Captioned image",
    fields: [
      { key: "src", label: "Image path" },
      { key: "alt", label: "Image description" },
    ],
    children: "Image caption.",
  },
  {
    name: "CaptionedVideo",
    label: "Video",
    fields: [
      { key: "src", label: "YouTube, Vimeo, or same-site video URL" },
      { key: "title", label: "Title" },
      { key: "caption", label: "Caption" },
    ],
  },
  {
    name: "CollapsibleSection",
    label: "Collapsible section",
    fields: [
      { key: "title", label: "Title" },
      { key: "subtitle", label: "Subtitle" },
    ],
    children: "Section content.",
  },
  {
    name: "ResourceGrid",
    label: "Resource grid",
    fields: [],
    children:
      '<ResourceCard title="Resource name" href="https://example.com" summary="What makes it useful." />',
  },
  {
    name: "ResourceCard",
    label: "Resource card",
    fields: [
      { key: "title", label: "Resource name" },
      { key: "href", label: "Link" },
      { key: "summary", label: "Summary" },
      { key: "badge", label: "Badge" },
      {
        key: "tone",
        label: "Category",
        type: "select",
        options: ["free", "paid", "freemium", "hardware"],
      },
    ],
  },
];
