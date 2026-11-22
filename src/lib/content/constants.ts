/** Cover artwork style. Each value maps to one cover component. */
export const coverTemplates = ["tech-mono", "field-notes", "bold-pop"] as const;

/** Font families a publication may use for headings and body copy. */
export const themeFonts = ["display", "body", "mono", "hand"] as const;

export const articleFormats = [
  "feature",
  "column",
  "brief",
  "field-notes",
  "postmortem",
  "tool-drop",
] as const;
export const readingLevels = [
  "beginner",
  "intermediate",
  "advanced",
  "all",
] as const;
