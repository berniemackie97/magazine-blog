import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import {
  publicationsSchema,
  issuesSchema,
  postsSchema,
} from "./lib/content/schema";
export { coverTemplates, themeFonts } from "./lib/content/schema";

const publications = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/publications" }),
  schema: publicationsSchema,
});
const issues = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/issues" }),
  schema: issuesSchema.extend({ publication: reference("publications") }),
});
const posts = defineCollection({
  loader: glob({ pattern: "*.mdx", base: "./src/content/posts" }),
  schema: postsSchema.extend({ publication: reference("publications") }),
});
export const collections = { publications, issues, posts };
