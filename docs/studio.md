# The Rack Studio

Studio manages the site's existing MDX articles and JSON publications/issues. Public pages remain prerendered. The editor, API, OAuth callback, and authenticated previews are server-rendered Node routes.

## Start locally

```sh
npm ci
npm run studio
```

Open `http://127.0.0.1:4321/studio`. Local access is available only in development, with the Studio launch flag, a loopback hostname, and a loopback client address. `npm run dev` does not enable this access. Keep the server bound to `127.0.0.1`.

Local saves update content files in this checkout. Each successful write retains the previous file under `.studio/history/`; that directory is ignored by Git. Browser recovery retains unsaved edits for seven days, scoped to the editor and entry. It supplements file history; it is not a backup of the repository. Keep normal repository backups.

Use the Release desk on `main` after application changes have been committed and synchronized. It checks relationships and MDX, runs type/content checks, tests, and a production build, stages only managed content/media paths, commits the content, and pushes to `origin/main`. Unrelated working-tree changes stop the release. It never force-pushes. If a push fails after the commit succeeds, the commit remains local; fix the reported Git access/protection problem and retry. Repeated release attempts may push earlier Studio release commits but reject unrelated unpublished application commits.

## Enable hosted editing

Create a GitHub OAuth app for the site, with:

- Homepage: `https://the-rack.vercel.app`
- Authorization callback: `https://the-rack.vercel.app/api/studio/auth/callback`

Configure these **server-side** environment variables in Vercel and redeploy:

| Variable                   | Value                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `CMS_ORIGIN`               | `https://the-rack.vercel.app` without a trailing slash                                |
| `CMS_GITHUB_CLIENT_ID`     | The OAuth app's client ID                                                             |
| `CMS_GITHUB_CLIENT_SECRET` | The OAuth app's client secret                                                         |
| `CMS_SESSION_SECRET`       | At least 32 cryptographically random characters; generate with `openssl rand -hex 32` |
| `CMS_ALLOWED_USERS`        | `berniemackie97`, or a comma-separated list of GitHub logins                          |
| `CMS_REPOSITORY`           | `berniemackie97/magazine-blog` (the default)                                          |
| `CMS_BASE_BRANCH`          | `main` (the default, also used for local publishing)                                  |

Never prefix secrets with `PUBLIC_` or commit them. Rotating `CMS_SESSION_SECRET` signs out every editor. Each permitted editor also needs GitHub write access to the repository. This OAuth setup requests `public_repo` and `read:user`; it supports this public repository. Keep allowed users limited to trusted content maintainers. Anyone authorized to edit source content can change what this site publishes.

Sign-in uses a one-time OAuth state cookie with a ten-minute lifetime. GitHub tokens are encrypted into a host-only, Secure, HttpOnly, SameSite=Lax session cookie with an eight-hour lifetime. Tokens never enter browser JavaScript or local storage. Mutations require the configured Origin; authorization is checked on every API/preview request. Hosted Studio is disabled on other domains, including arbitrary Vercel preview domains. Sign out ends the Studio browser session; revoke the app in GitHub's authorized applications settings to revoke its GitHub access.

### Hosted workflow

1. Open `/studio` and sign in with GitHub.
2. Create or edit articles, publications, and issues. Saves commit only managed content or image files to `cms/editorial`.
3. Preview saved content through the actual site components, including draft issues and articles.
4. Use **Refresh** to merge production changes into the editorial branch. GitHub conflicts stop synchronization; resolve those on the branch before continuing.
5. Prepare a release. Studio opens/reuses a pull request from `cms/editorial` to the configured base branch.
6. Review content previews and the PR. The Release desk shows current checks. Publishing requires a successful GitHub Actions `verify` check, no failing or pending reported checks/statuses, and a clean mergeable PR.
7. Publish the reviewed release. GitHub merges only the expected PR head. Branch protections still apply. Production deployment then runs through the existing Vercel Git integration.

The completion message distinguishes a merged/pushed release from a deployed site. Verify deployment in Vercel. The editorial branch is retained for revision history. When it is already contained in production, Studio reads the production snapshot for the next edit. Concurrent saves during review change the head and invalidate the reviewed release.

`vercel.json` skips automatic deployments of `cms/editorial`; drafts are previewed through authenticated Studio routes. The GitHub repository itself is public: committing a draft does not make its source private. Store confidential writing in a private repository before using repository-backed hosted drafts.

## Writing and editing

- Slugs are stable file identifiers selected when creating content. Article URLs use their file identifier; issue URLs use publication + issue slug. Existing identifiers are not renamed through the editor.
- Article templates cover features, columns, briefs, field notes, postmortems, and tool drops.
- The editor preserves MDX source, offers standard formatting and component forms, and previews saved content. It is a source editor, not a rich-text document conversion layer.
- All seven existing magazine components are available. Literal strings, numbers, booleans, arrays, and objects are supported in component props. Imports, exports, executable expressions, event attributes, spread props, and unsafe URLs are rejected in both CMS validation and site builds.
- Component props share contracts with the Astro components. Invalid array/object shapes are rejected before they can break rendering.
- Autosave waits for a valid document. While syntax or metadata is incomplete, browser recovery retains edits and the editor reports the validation error. Save failures never clear the recovery copy.
- A conflicting revision stops the save. Refresh, choose **Recover edits**, reconcile against the current content, and save again. Recovery is never silently applied over a newer server revision.
- Revision history compares earlier content with the current saved version. Restoring an article sets it to draft; restoring an issue sets its visibility to draft. Restores are validated and create another revision.
- Deletion is blocked if it breaks content relationships. Deleted files can be recovered from Git history or the local `.studio/history` records; delete does not create a separate trash collection.

### Issues and article visibility

`status: open | locked` describes issue assembly and cover presentation. `visibility: draft | public` controls public visibility separately. New issues default to draft in the editor; existing issue files without visibility remain public for compatibility.

An article's `draft` flag controls its readiness. An article belonging to a draft issue is excluded from public article routes, listings, and feeds even if its own draft flag is false. Standalone articles publish independently. Release issue changes and article readiness together through one reviewed Git release when publishing a complete edition.

`order` controls the table of contents and article navigation. `coverPriority` controls automatic cover-line selection. Publication dates are display metadata, not scheduled release triggers. This CMS uses explicit publishing; it does not promise timed publication without a deployment.

### Images

The media library includes existing `public/images` and new `public/media` images. Uploads accept PNG, JPEG, and WebP still images up to 8 MB and 40 million pixels. Sharp decodes them, applies orientation, strips source metadata, resizes to at most 2400 pixels wide, and re-encodes to WebP. Content-hashed filenames avoid accidental replacement. Animated inputs are rejected rather than silently flattened. Image insertion asks for alt text and supports a caption. Referenced images cannot be deleted. The preview retrieves editorial images through an authenticated, uncached endpoint.

## Verification

```sh
npm run check
npm test
npm run build
npm run test:production
npm run test:browser
```

The production integration command exercises the built Vercel serverless modules with an isolated GitHub API fixture. It verifies authorization, writes, conflict rejection, unsafe-MDX rejection, cross-origin protection, release gating, publishing, and article/issue/publication preview rendering without a network listener or real repository mutation. CI runs it after the production build.

Real OAuth sign-in, GitHub branch protections, and the production deployment still require a configured environment and an end-to-end acceptance pass. An integration fixture is not evidence that production credentials or Vercel settings have been configured.
