import { createClient } from "@sanity/client";
import type { SanityClient } from "@sanity/client";

const projectId = import.meta.env.SANITY_PROJECT_ID;
const dataset = import.meta.env.SANITY_DATASET;
const token = import.meta.env.SANITY_READ_TOKEN;

let client: SanityClient | null = null;
let previewClient: SanityClient | null = null;

if (projectId && dataset) {
  client = createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    useCdn: true,
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
