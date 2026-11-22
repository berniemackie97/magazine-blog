import { getCollection } from "astro:content";
import type { Publication } from "./types";

export async function getPublications(): Promise<Publication[]> {
  const entries = await getCollection("publications");
  return entries
    .map((entry) => ({ ...entry.data, id: entry.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPublicationMap(): Promise<Map<string, Publication>> {
  const publications = await getPublications();
  return new Map(publications.map((p) => [p.id, p]));
}

export async function requirePublication(id: string): Promise<Publication> {
  const publication = (await getPublicationMap()).get(id);
  if (!publication) throw new Error(`Unknown publication "${id}"`);
  return publication;
}

export function sectionLabel(publication: Publication, sectionId: string): string {
  return publication.sections.find((s) => s.id === sectionId)?.label ?? sectionId;
}
