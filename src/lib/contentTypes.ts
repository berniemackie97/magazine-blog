export type CoverTemplateId =
  | "classic"
  | "ops-bulletin"
  | "field-notes"
  | "neon-pop"
  | "ledger"
  | "zine-collage"
  | "newspaper"
  | (string & {});

export type CoverTheme = {
  paper?: string; // --cover-paper
  ink?: string; // --cover-ink
  accent?: string; // --cover-accent
  alt?: string; // --cover-alt
  photo?: string; // --cover-photo (gradient or url(...))
  tilt?: string; // --cover-tilt (ex: "-1.25deg")
};

export type CoverBlockTone = "paper" | "ink" | "muted" | "accent";
export type CoverBlockAlign = "start" | "center" | "end";

export type CoverBlockType =
  | "masthead"
  | "title"
  | "meta"
  | "art"
  | "featureList"
  | "sticker"
  | "barcode"
  | "cta"
  | "spine";

export interface CoverBlockBase {
  id: string;
  type: CoverBlockType;
  area: string; // CSS grid-area name
  tone?: CoverBlockTone;
  rotate?: number; // degrees
  align?: CoverBlockAlign;
  hidden?: boolean;
}

export interface CoverBlockMasthead extends CoverBlockBase {
  type: "masthead";
  publicationName: string;
  statusText?: string;
}

export interface CoverBlockTitle extends CoverBlockBase {
  type: "title";
  title: string;
  dek?: string;
}

export interface CoverBlockMeta extends CoverBlockBase {
  type: "meta";
  left?: string;
  right?: string;
  price?: string;
}

export interface CoverBlockArt extends CoverBlockBase {
  type: "art";
  background?: string; // CSS background value (gradient or url(...))
}

export type CoverFeatureItem = { no?: string; text: string };

export interface CoverBlockFeatureList extends CoverBlockBase {
  type: "featureList";
  items: CoverFeatureItem[];
  heading?: string;
  hint?: string;
}

export interface CoverBlockSticker extends CoverBlockBase {
  type: "sticker";
  big: string;
  small?: string;
}

export interface CoverBlockBarcode extends CoverBlockBase {
  type: "barcode";
}

export interface CoverBlockCta extends CoverBlockBase {
  type: "cta";
  text: string;
}

export interface CoverBlockSpine extends CoverBlockBase {
  type: "spine";
  text: string;
}

export type CoverBlock =
  | CoverBlockMasthead
  | CoverBlockTitle
  | CoverBlockMeta
  | CoverBlockArt
  | CoverBlockFeatureList
  | CoverBlockSticker
  | CoverBlockBarcode
  | CoverBlockCta
  | CoverBlockSpine;

export type CoverBlockInput = CoverBlockBase & {
  publicationName?: string;
  statusText?: string;
  title?: string;
  dek?: string;
  left?: string;
  right?: string;
  price?: string;
  background?: string;
  heading?: string;
  hint?: string;
  items?: CoverFeatureItem[];
  big?: string;
  small?: string;
  text?: string;
};

export type CoverLayout = {
  cols: string;
  rows?: string;
  areas: string[]; // each entry is a row, ex: ["mast mast", "title title"]
  gap?: string;
  pad?: string;
  minHeight?: number;
};

export type CoverLayoutInput = Omit<CoverLayout, "areas"> & {
  areas?: string[];
};

export type CoverSpec = {
  template: CoverTemplateId;
  theme?: CoverTheme;
  layout: CoverLayout;
  blocks: CoverBlock[];
};

export type CoverSpecInput = {
  template: CoverTemplateId;
  theme?: CoverTheme;
  layout?: CoverLayoutInput;
  blocks?: CoverBlockInput[];
};

export type IssueCoverOverrides = {
  leadPostSlug?: string;
  secondaryPostSlugs?: string[];
};

// Content types

export type PublicationData = {
  id: string;
  name: string;
  description: string;
  accent: string;
  displayFont: string;
  sections: { id: string; label: string }[];
  isFeatured: boolean;
  defaultCoverSpec?: CoverSpecInput;
};

export type IssueData = {
  publicationId: string;
  issueSlug: string;
  displayTitle: string;
  volume: number;
  number: number;
  date: string;
  theme: string;
  status: "open" | "locked";
  notesFromEditor?: string;
  coverOverrides?: IssueCoverOverrides;
  coverSpec: CoverSpec;
};

export type PostFormat =
  | "feature"
  | "column"
  | "brief"
  | "field-notes"
  | "postmortem"
  | "tool-drop";

export type PostDifficulty = "beginner" | "intermediate" | "advanced" | "all";
export type CoverSlot = "lead" | "secondary" | "brief";

export type PostData = {
  publicationId: string;
  issueSlug?: string;
  sectionId: string;
  format: PostFormat;
  difficulty: PostDifficulty;
  publishedAt: string;
  updatedAt?: string;
  headline: string;
  dek: string;
  summary: string;
  tags: string[];
  draft: boolean;
  coverSlot?: CoverSlot;
  coverPriority?: number;
  heroImage?: unknown;
  heroAlt?: string;
};

export type PublicationRecord = { id: string; data: PublicationData };
export type IssueRecord = { id: string; data: IssueData };

export type PostRecord = {
  id: string;
  slug: string;
  data: PostData;
  readingTimeMinutes: number;
};
