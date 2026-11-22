import readingTime from "reading-time";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "astro/jsx-runtime";
import remarkGfm from "remark-gfm";
import type { Root } from "hast";
import type { VFile } from "vfile";
import { rehypeHeadingIds, rehypeShiki } from "@astrojs/markdown-remark";
import { mdxPolicy } from "./mdx-policy";
import {
  issuesSchema,
  postsSchema,
  publicationsSchema,
} from "../content/schema";
import type { Entry } from "./content";
import type { Issue, Post, Publication } from "../content/types";

export function publicationModel(entry: Entry): Publication {
  return { ...publicationsSchema.parse(entry.data), id: entry.id };
}
export function issueModel(entry: Entry): Issue {
  const { publication, ...data } = issuesSchema.parse(entry.data);
  return { ...data, publicationId: publication, key: entry.id };
}
export function postModel(entry: Entry): Post {
  const { publication, issue, ...data } = postsSchema.parse(entry.data);
  return {
    ...data,
    id: entry.id,
    publicationId: publication,
    issueSlug: issue,
    readingMinutes: Math.max(1, Math.round(readingTime(entry.body).minutes)),
    entry: {
      id: entry.id,
      collection: "posts",
      body: entry.body,
      data: {
        ...data,
        publication: { collection: "publications", id: publication },
        issue,
      },
    },
  };
}
export async function compilePreview(body: string) {
  const headings: { depth: number; slug: string; text: string }[] = [];
  function collectHeadings() {
    return (_tree: Root, file: VFile): void => {
      const data = file.data as { astro?: { headings?: typeof headings } };
      headings.push(...(data.astro?.headings ?? []));
    };
  }
  const result = await evaluate(
    { value: body, path: "preview.mdx" },
    {
      ...runtime,
      development: false,
      remarkPlugins: [mdxPolicy, remarkGfm],
      rehypePlugins: [
        rehypeHeadingIds,
        collectHeadings,
        [rehypeShiki, { theme: "github-dark" }],
      ],
    },
  );
  // Astro's JSX renderer accepts the evaluated MDX component and registered Astro components.
  return { Content: result.default, headings };
}
