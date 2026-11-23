# Editorial design references

The implementation keeps The Rack's content model and frontend. These maintained projects were inspected for specific behavior, rather than treating a generic dashboard as sufficient evidence of a usable CMS.

| Reference | Inspected implementation                                                                                                                                                                                                                                                                                          | Decision in Studio                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Keystatic | [`updating.tsx`](https://github.com/Thinkmill/keystatic/blob/main/packages/keystatic/src/app/updating.tsx), especially expected-head commits and entry-change checks                                                                                                                                              | Require the expected workspace revision on mutations; reject stale saves. Preserve recovery rather than overwriting.                     |
| Decap CMS | [GitHub backend `API.ts`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-backend-github/src/API.ts), [`entries.ts`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/src/actions/entries.ts), and [editorial workflow](https://decapcms.org/docs/editorial-workflows/) | Separate content saves from release; use Git commits, branches, PRs, and explicit publish controls.                                      |
| Payload   | [`saveVersion.ts`](https://github.com/payloadcms/payload/blob/main/packages/payload/src/versions/saveVersion.ts) and [`restoreVersion.ts`](https://github.com/payloadcms/payload/blob/main/packages/payload/src/collections/operations/restoreVersion.ts)                                                         | Retain history; authorize and validate restores; restore editorial content as a draft.                                                   |
| TinaCMS   | [MDX parser](https://github.com/tinacms/tinacms/blob/main/packages/@tinacms/mdx/src/parse/index.ts) and [URL handling](https://github.com/tinacms/tinacms/blob/main/packages/@tinacms/mdx/src/sanitize-url.ts)                                                                                                    | Preserve source instead of introducing a lossy rich-text round trip. Explicitly restrict executable MDX and check nested component URLs. |

These are behavioral references, not copied CMS modules. The parser/compiler, YAML handling, image processing, and Astro rendering use the existing maintained ecosystem packages. Public reading pages do not load the Studio client.

## Boundaries

- `src/lib/content/schema.ts` is the field contract shared by Astro and Studio.
- `component-schema.ts` is the shared component prop contract; MDX compilation enforces it.
- `studio/auth.ts` owns hosted sessions and local-access rules.
- `studio/store.ts` owns revision-aware local/GitHub persistence and history.
- `studio/service.ts` coordinates validation, content changes, media, and release requests.
- `studio/releases.ts` owns the local validation/push job and hosted PR/check/merge lifecycle.
- `studio/preview.ts` compiles constrained MDX; shared article and issue document components render previews and public pages.
- The Studio client owns form state, autosave sequencing, recovery, library navigation, dialogs, and release controls. Server modules are not imported into the client bundle.

The intended comparison is dependable authoring for this site's supported content, not feature parity with general-purpose CMS platforms. This is a trusted-maintainer editorial tool. It does not implement multi-tenant hosting, arbitrary third-party plugins, translation workflows, scheduled jobs, or a general page builder.
