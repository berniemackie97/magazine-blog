import { site } from "../config/site";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a YYYY-MM-DD string as a UTC date. Content dates carry no time zone,
 * so treating them as UTC keeps sorting and formatting stable across build hosts.
 */
export function parseIsoDate(value: string): Date {
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`Invalid ISO date: "${value}"`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date: "${value}"`);
  }
  return date;
}

/** Newest first. */
export function compareIsoDatesDesc(a: string, b: string): number {
  return parseIsoDate(b).getTime() - parseIsoDate(a).getTime();
}

export type DateStyle = "long" | "short" | "compact";

const formats: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { year: "numeric", month: "long", day: "numeric" },
  short: { year: "numeric", month: "short", day: "numeric" },
  compact: { month: "short", day: "numeric" },
};

export function formatDate(value: string, style: DateStyle = "short"): string {
  return new Intl.DateTimeFormat(site.locale, {
    ...formats[style],
    timeZone: "UTC",
  }).format(parseIsoDate(value));
}
