import type { Publication } from "./content/types";

type ThemeFont = Publication["theme"]["headingFont"];

const fontStacks: Record<ThemeFont, string> = {
  display: "var(--font-display)",
  body: "var(--font-body)",
  mono: "var(--font-mono)",
  hand: "var(--font-hand)",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function hex(value: string): string {
  if (!HEX.test(value)) throw new Error(`Refusing non-hex theme color: ${value}`);
  return value;
}

/** Serialises custom properties into an inline `style` value. */
export function toStyle(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
}

/** Page-level theme: drives backgrounds, text, borders and fonts. */
export function pageThemeVars(publication: Publication): Record<string, string> {
  const t = publication.theme;
  return {
    "--page-bg": hex(t.background),
    "--page-surface": hex(t.surface),
    "--page-text": hex(t.text),
    "--page-muted": hex(t.textMuted),
    "--page-accent": hex(t.accent),
    "--page-accent-alt": hex(t.accentAlt),
    "--page-border": hex(t.border),
    "--page-heading-font": fontStacks[t.headingFont],
    "--page-body-font": fontStacks[t.bodyFont],
  };
}

/** Cover-level palette: scoped to one cover so covers never leak into each other. */
export function coverVars(publication: Publication): Record<string, string> {
  const c = publication.cover;
  return {
    "--cover-paper": hex(c.paper),
    "--cover-ink": hex(c.ink),
    "--cover-accent": hex(c.accent),
    "--cover-spine": hex(c.spine),
  };
}
