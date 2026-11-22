import { unified } from "@astrojs/markdown-remark";
import { mdxPolicy } from "./src/lib/studio/mdx-policy.ts";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://the-rack.vercel.app",
  output: "static",
  compressHTML: true,
  trailingSlash: "never",
  adapter: vercel(),
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: unified({ remarkPlugins: [mdxPolicy] }),
    shikiConfig: { theme: "github-dark" },
  },
  vite: {
    build: {
      // Never inline scripts: keeps the Content-Security-Policy free of 'unsafe-inline' for scripts.
      assetsInlineLimit: 0,
    },
  },
});
