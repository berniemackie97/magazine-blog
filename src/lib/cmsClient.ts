import { createClient } from "@sanity/client";
import type { SanityClient } from "@sanity/client";

// Use process.env for runtime vars (SSR on Vercel), fallback to import.meta.env for dev
const projectId = process.env.SANITY_PROJECT_ID ?? import.meta.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET ?? import.meta.env.SANITY_DATASET;
const token = process.env.SANITY_READ_TOKEN ?? import.meta.env.SANITY_READ_TOKEN;

const enabledRaw = String(process.env.SET_SANITY_ENABLED ?? import.meta.env.SET_SANITY_ENABLED ?? "")
  .trim()
  .toLowerCase();

const sanityEnabled =
  enabledRaw === "1" ||
  enabledRaw === "true" ||
  enabledRaw === "yes" ||
  enabledRaw === "on";

let client: SanityClient | null = null;
let previewClient: SanityClient | null = null;

if (sanityEnabled && projectId && dataset) {
  client = createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    useCdn: true,
    token, // Include token for private datasets
  });

  if (token) {
    previewClient = createClient({
      projectId,
      dataset,
      apiVersion: "2024-01-01",
      useCdn: false,
      token,
      perspective: "previewDrafts",
    });
  }
}

export { client, previewClient };
