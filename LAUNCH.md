# Launch Checklist

This site is ready for Vercel or Netlify. RSS lives at `/rss.xml`. Preview route (`/preview/[slug]`) needs SSR and uses the Vercel adapter currently set in `astro.config.mjs`.

## 1) Install & Build Locally
- `npm install`
- `npm run check`
- `npm run build`

## 2) Configure Adapter
- Vercel (current): keep `adapter: vercel({ mode: 'serverless' })` in `astro.config.mjs`.
- Netlify: install `@astrojs/netlify` and swap the adapter import + config.
  - `npm install @astrojs/netlify`
  - In `astro.config.mjs`: `import netlify from '@astrojs/netlify/functions';` then set `adapter: netlify()` (output defaults to static and is fine).

## 3) Environment Vars
- Copy `.env.example` to `.env` and set your Sanity project dataset/IDs; add the same keys in your hosting dashboard.
- Set `site` in `astro.config.mjs` to your live domain so RSS and sitemap are correct.

## 4) Deploy
- Vercel: `vercel deploy --prod` (or push to the connected repo). Vercel auto-builds with the adapter.
- Netlify: create a site from the repo; build command `npm run build`, publish directory `dist`.

## 5) RSS
- Feed path: `/rss.xml` (file: `src/pages/rss.xml.js`). No extra config needed once `site` is correct.

## 6) Sanity Webhooks -> Rebuilds
Point Sanity webhooks at your host’s build/deploy hook so content changes trigger rebuilds.

### Vercel Build Hook
1. In Vercel, Project Settings → Git → Deploy Hooks → create hook (e.g., `sanity-content`).
2. Copy the URL (format `https://api.vercel.com/v1/integrations/deploy/prj_<id>/<token>`).
3. In Sanity, create a webhook:
   - URL: the Vercel hook URL
   - Trigger: “Create, Update, Delete” on `post`, `issue`, `publication`
   - Deliver payload: default is fine

Sample cURL for manual trigger:
```
curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_<id>/<token>"
```

### Netlify Build Hook
1. In Netlify, Site Settings → Build & deploy → Build hooks → “Add build hook”.
2. Copy the URL (format `https://api.netlify.com/build_hooks/<hook_id>`).
3. In Sanity, add a webhook with that URL and the same triggers as above.

Sample cURL:
```
curl -X POST "https://api.netlify.com/build_hooks/<hook_id>"
```

## 7) Preview Hook (Optional)
If you want a “Preview” button in Sanity (already wired in `sanity.config.ts`):
- Set the base preview URL there (defaults to `http://localhost:4321/preview`). On Vercel/Netlify, update it to your live preview domain and redeploy the Studio.

## 8) Post-launch Smoke Test
- `/` renders with covers
- `/issues`, `/archive`, `/publications`, issue detail, post detail load
- `/rss.xml` returns valid XML (check in browser)
- Trigger a Sanity webhook and confirm a new deploy starts

That’s it—deploy with either platform and wire the build hook from Sanity to keep the site fresh.
