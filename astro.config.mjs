import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://the-rack.vercel.app",
  output: "static",
  trailingSlash: "never",
  adapter: vercel(),
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: { theme: "github-dark" },
  },
  vite: {
    build: {
      // Never inline scripts: keeps the Content-Security-Policy free of 'unsafe-inline' for scripts.
      assetsInlineLimit: 0,
    },
  },
});
