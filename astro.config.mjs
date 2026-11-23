import { fileURLToPath } from "node:url";
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
  devToolbar: { enabled: process.env.RACK_STUDIO_LOCAL !== "1" },
  trailingSlash: "never",
  adapter: vercel(),
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: unified({ remarkPlugins: [mdxPolicy] }),
    shikiConfig: { theme: "github-dark" },
  },
  vite: {
    resolve: {
      // The browser export uses document; MDX analysis runs in a DOM-free worker.
      alias: {
        "decode-named-character-reference": fileURLToPath(
          import.meta.resolve("decode-named-character-reference"),
        ),
      },
    },
    optimizeDeps: {
      include: [
        "@mdx-js/mdx",
        "remark-gfm",
        "prettier/standalone",
        "prettier/plugins/markdown",
        "prettier/plugins/babel",
        "prettier/plugins/estree",
      ],
    },
    server: { hmr: process.env.RACK_STUDIO_LOCAL === "1" ? false : undefined },
    build: {
      // Never inline scripts: keeps the Content-Security-Policy free of 'unsafe-inline' for scripts.
      assetsInlineLimit: 0,
    },
  },
});
