[![wakatime](https://wakatime.com/badge/user/dd1b4aee-71e4-41d0-a2d8-e1b2a0865b30/project/7b58bf34-5510-44e2-b18e-96a4ba940467.svg)](https://wakatime.com/badge/user/dd1b4aee-71e4-41d0-a2d8-e1b2a0865b30/project/7b58bf34-5510-44e2-b18e-96a4ba940467)

# The Rack

Guides, writeups, and experiments published as virtual magazines. Live at [the-rack.vercel.app](https://the-rack.vercel.app).

Built with Astro, MDX, and zero client-side frameworks. Public reading pages are static; Studio uses authenticated server-rendered routes.

## Commands

| Command         | What it does                            |
| --------------- | --------------------------------------- |
| `npm run dev`   | Local dev server at `localhost:4321`    |
| `npm run check` | Type-check and validate content schemas |
| `npm test`      | Unit tests (Vitest)                     |
| `npm run build` | Production build                        |

## Editorial Studio

Run `npm run studio` and open `http://127.0.0.1:4321/studio` to write and manage articles, issues, publications, and images. Hosted editing uses GitHub sign-in, an editorial branch, revision history, private previews, and checked releases. See [Studio operations and deployment](docs/studio.md) and [design references](docs/studio-design.md).

## Content model

```
src/content/
  publications/<id>.json   A topic lane: name, beat, cover template, page theme
  issues/<id>.json         A release: references a publication, has a slug, date, assembly status, visibility
  posts/<slug>.mdx         An article: references a publication and (optionally) an issue
```

- Dates are ISO `YYYY-MM-DD`; the build fails on anything else.
- A post's `section` must exist in its publication's `sections`, and its `issue` must exist. The build fails on broken references.
- Draft issues hide their assigned articles from public routes, listings, and feeds. Article order and cover prominence are independent.
- Issues with `"status": "open"` show up shrink-wrapped as "in progress" on the rack.
- MDX components (`Callout`, `PullQuote`, `ResourceGrid`, `ResourceCard`, `CollapsibleSection`, `CaptionedFigure`, `CaptionedVideo`) are available in every post without imports.

### Adding a publication

1. Add `src/content/publications/<id>.json`. Pick a `cover.template` (`tech-mono`, `field-notes`, `bold-pop`) and a `theme`.
2. `paperAccent` must be readable on light paper (4.5:1); it colors kickers on the newsprint listings.

## Architecture

```
src/
  config/        Site-wide constants (name, nav)
  content.config.ts  Collection schemas (Zod)
  lib/           Pure logic, no UI
    content/     Queries and joins over collections, cover lines, folio numbering
    dates.ts     Strict ISO parsing and UTC-safe formatting
    theme.ts     Publication theme -> CSS custom properties
    tilt.ts      Deterministic cover tilt
    video.ts     Allow-listed video embed resolution
  components/    One responsibility per component, scoped styles
    site/        Header, footer, awning, layout primitives
    rack/        Rack frame, shelves, magazine slots
    cover/       Cover dispatcher + one component per template
    issue/       Open-magazine spread, contents, editor's letter
    article/     Article header, rail, prose, reading progress
    articles/    Article listings and archive filters
    mdx/         Components available inside posts
  layouts/       Document shell
  pages/         Routes only: load data, compose components
  scripts/       Client-side behaviour (bundled, never inlined)
  styles/        Tokens and base element styles only
```

Pages never query collections directly; they go through `src/lib/content`. Global CSS is limited to tokens and element resets; everything else is scoped to its component.

## Security

Response headers live in `vercel.json`: a strict Content-Security-Policy (no inline scripts; Vite's asset inlining is disabled so this holds), HSTS, `nosniff`, a locked-down Permissions-Policy, and frame denial. Fonts are self-hosted. Video embeds accept YouTube (privacy-enhanced domain), Vimeo, and same-site files only.
