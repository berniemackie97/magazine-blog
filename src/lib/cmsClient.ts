import { createClient } from '@sanity/client';
import type { SanityClient } from '@sanity/client';

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET;
const token = process.env.SANITY_READ_TOKEN;

let client: SanityClient | null = null;

if (projectId && dataset) {
  client = createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    useCdn: true,
    token,
  });
}

export { client };
