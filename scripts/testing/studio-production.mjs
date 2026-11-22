import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Exercise the built serverless code without opening a network listener.
const root = process.cwd();
const server = resolve(
  root,
  ".vercel/output/functions/_render.func/.vercel/output/server",
);
const files = {};
for (const collection of ["posts", "issues", "publications"])
  for (const name of await readdir(`src/content/${collection}`))
    files[`src/content/${collection}/${name}`] = await readFile(
      `src/content/${collection}/${name}`,
      "utf8",
    );
const sha = (value) => createHash("sha1").update(value).digest("hex");
const blobs = new Map(
  Object.entries(files).map(([, content]) => [
    sha(content),
    Buffer.from(content),
  ]),
);
let tree = Object.fromEntries(
  Object.entries(files).map(([path, content]) => [path, sha(content)]),
);
let baseRevision = "a".repeat(40);
let revision = baseRevision;
let draftExists = false;
let merged = false;
const trees = new Map([[revision, tree]]);
const commits = new Map();
let verified = false;
process.env.CMS_ORIGIN = "https://the-rack.vercel.app";
process.env.CMS_SESSION_SECRET =
  "production-integration-test-secret-at-least-32-chars";
process.env.CMS_ALLOWED_USERS = "berniemackie97";
const iv = randomBytes(12);
const cipher = createCipheriv(
  "aes-256-gcm",
  createHash("sha256").update(process.env.CMS_SESSION_SECRET).digest(),
  iv,
);
const encrypted = Buffer.concat([
  cipher.update(
    JSON.stringify({
      login: "berniemackie97",
      token: "fixture-token",
      expires: Date.now() + 60_000,
    }),
  ),
  cipher.final(),
]);
const cookie = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
  "base64url",
);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const path = url.pathname.replace("/repos/berniemackie97/magazine-blog", "");
  const body = init.body ? JSON.parse(init.body) : {};
  assert.equal(
    url.origin,
    "https://api.github.com",
    "Unexpected external request",
  );
  if (path.startsWith("/commits/") && path.endsWith("/check-runs"))
    return Response.json({
      total_count: 1,
      check_runs: [
        {
          name: "verify",
          app: { slug: "github-actions" },
          status: "completed",
          conclusion: verified ? "success" : "failure",
        },
      ],
    });
  if (path.startsWith("/commits/") && path.endsWith("/status"))
    return Response.json({ state: "success", statuses: [] });
  if (path.startsWith("/commits/")) {
    const branch = decodeURIComponent(path.slice("/commits/".length));
    if (branch === "cms/editorial" && !draftExists)
      return Response.json({}, { status: 404 });
    const head = branch === "main" ? baseRevision : revision;
    return Response.json({ sha: head, commit: { tree: { sha: head } } });
  }
  if (path.startsWith("/compare/"))
    return Response.json({ ahead_by: merged ? 0 : 1, behind_by: 0 });
  if (path.startsWith("/git/trees/") && !init.method) {
    const snapshot = trees.get(path.split("/").pop());
    assert.ok(snapshot, "Unknown immutable tree");
    return Response.json({
      truncated: false,
      tree: Object.entries(snapshot).map(([path, sha]) => ({
        path,
        sha,
        type: "blob",
      })),
    });
  }
  if (path.startsWith("/contents/")) {
    const ref = url.searchParams.get("ref");
    const snapshot = trees.get(ref);
    const file = snapshot?.[path.slice("/contents/".length)];
    return file
      ? Response.json({ content: blobs.get(file).toString("base64") })
      : Response.json({}, { status: 404 });
  }
  if (path.startsWith("/git/blobs/"))
    return Response.json({
      content: Buffer.from(blobs.get(path.split("/").pop())).toString("base64"),
    });
  if (path === "/git/blobs") {
    const content = Buffer.from(
      body.content,
      body.encoding === "base64" ? "base64" : "utf8",
    );
    const id = sha(content);
    blobs.set(id, content);
    return Response.json({ sha: id });
  }
  if (path === "/git/trees") {
    const next = { ...trees.get(body.base_tree) };
    for (const item of body.tree) {
      if (item.sha) next[item.path] = item.sha;
      else delete next[item.path];
    }
    const id = sha(JSON.stringify(next));
    trees.set(id, next);
    return Response.json({ sha: id });
  }
  if (path === "/git/commits") {
    const id = sha(JSON.stringify(body));
    commits.set(id, body);
    trees.set(id, trees.get(body.tree));
    return Response.json({ sha: id });
  }
  if (path === "/git/ref/heads/cms/editorial")
    return draftExists
      ? Response.json({ object: { sha: revision } })
      : Response.json({}, { status: 404 });
  if (path === "/git/refs") {
    draftExists = true;
    return Response.json({ object: { sha: revision } });
  }
  if (path === "/git/refs/heads/cms/editorial") {
    const commit = commits.get(body.sha);
    assert.equal(commit.parents[0], revision);
    revision = body.sha;
    tree = trees.get(commit.tree);
    return Response.json({ object: { sha: revision } });
  }
  if (path === "/pulls")
    return Response.json([
      {
        number: 1,
        html_url: "https://github.com/berniemackie97/magazine-blog/pull/1",
        head: { sha: revision },
      },
    ]);
  if (path === "/pulls/1")
    return Response.json({
      number: 1,
      html_url: "https://github.com/berniemackie97/magazine-blog/pull/1",
      head: { sha: revision },
      mergeable: true,
      mergeable_state: "clean",
    });
  if (path === "/pulls/1/merge") {
    merged = true;
    baseRevision = revision;
    return Response.json({ merged: true, sha: revision });
  }
  throw new Error(`Unhandled GitHub fixture: ${path}`);
};
try {
  const { default: app } = await import(
    pathToFileURL(resolve(server, "entry.mjs"))
  );
  assert.equal(typeof app.fetch, "function");
  const endpoint = (context) => app.fetch(context.request);
  const context = (action, body, authenticated = true) => {
    const url = new URL(`https://the-rack.vercel.app/api/studio/${action}`);
    return {
      url,
      params: { path: action },
      clientAddress: "203.0.113.1",
      cookies: { get: () => (authenticated ? { value: cookie } : undefined) },
      request: new Request(url, {
        method: body ? "POST" : "GET",
        headers: {
          origin: url.origin,
          "Content-Type": "application/json",
          ...(authenticated ? { cookie: `__Host-rack_studio=${cookie}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    };
  };
  const denied = await endpoint(context("library", undefined, false));
  assert.equal(denied.status, 401);
  const initialResponse = await endpoint(context("library"));
  assert.equal(initialResponse.status, 200);
  const initial = await initialResponse.json();
  assert.equal(initial.entries.length, Object.keys(files).length);
  const article = initial.entries.find((e) => e.collection === "posts");
  const edit = {
    ...article,
    data: { ...article.data, headline: "A production integration test" },
    revision: initial.revision,
  };
  const saved = await endpoint(context("save", edit));
  assert.equal(saved.status, 200);
  const updated = await saved.json();
  assert.equal(
    updated.entries.find((e) => e.id === article.id).data.headline,
    edit.data.headline,
  );
  const stale = await endpoint(context("save", edit));
  assert.equal(stale.status, 409);
  const invalid = await endpoint(
    context("save", {
      ...edit,
      revision: updated.revision,
      body: "{process.env.SECRET}",
    }),
  );
  assert.equal(invalid.status, 422);
  const foreign = context("save", edit);
  foreign.request = new Request(foreign.url, {
    method: "POST",
    headers: { origin: "https://evil.test" },
    body: JSON.stringify(edit),
  });
  assert.equal((await endpoint(foreign)).status, 403);
  const missingPublication = await endpoint(
    context("save", {
      ...edit,
      data: { ...edit.data, publication: "does-not-exist" },
      revision,
    }),
  );
  assert.equal(missingPublication.status, 422);
  const publication = initial.entries.find(
    (e) => e.collection === "publications" && e.id === article.data.publication,
  );
  const referenced = await endpoint(
    context("delete", {
      collection: "publications",
      id: publication.id,
      revision,
    }),
  );
  assert.equal(referenced.status, 422);
  const { default: sharp } = await import("sharp");
  const image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#185b47" },
  })
    .png()
    .toBuffer();
  const uploadedResponse = await endpoint(
    context("upload", {
      name: "Test photo.png",
      content: image.toString("base64"),
      revision,
    }),
  );
  assert.equal(uploadedResponse.status, 200);
  const uploaded = await uploadedResponse.json();
  assert.match(uploaded.path, /^public\/media\/test-photo-[a-f0-9]{12}\.webp$/);
  // The route parameter excludes the query string, as it does in Astro.
  const imageContext = context("media");
  imageContext.url.searchParams.set("path", uploaded.path);
  const loadedImage = await endpoint(imageContext);
  assert.equal(loadedImage.status, 200);
  assert.equal(loadedImage.headers.get("Content-Type"), "image/webp");
  const decodedImage = await sharp(
    Buffer.from(await loadedImage.arrayBuffer()),
  ).metadata();
  assert.equal(decodedImage.format, "webp");
  const badImage = await endpoint(
    context("upload", {
      name: "not-an-image.png",
      content: Buffer.from("<script>bad</script>").toString("base64"),
      revision,
    }),
  );
  assert.equal(badImage.status, 422);
  const deletedImage = await endpoint(
    context("delete-media", { path: uploaded.path, revision }),
  );
  assert.equal(deletedImage.status, 200);
  const blocked = await endpoint(context("publish", { revision }));
  assert.equal(blocked.status, 409);
  verified = true;
  const status = await (await endpoint(context("release"))).json();
  assert.equal(status.ready, true);
  const published = await endpoint(context("publish", { revision }));
  assert.equal(published.status, 200);
  const html = await (
    await app.fetch(
      new Request("https://the-rack.vercel.app/studio", {
        headers: { cookie: `__Host-rack_studio=${cookie}` },
      }),
    )
  ).text();
  assert.ok(html.includes('id="studio"'));
  assert.ok(html.includes('id="release-panel"'));
  for (const path of ["/_image", "/%5Fimage"]) {
    assert.equal(
      (await app.fetch(new Request("https://the-rack.vercel.app" + path)))
        .status,
      404,
    );
  }
  for (const collection of ["posts", "issues", "publications"]) {
    const entry = updated.entries.find(
      (e) =>
        e.collection === collection &&
        (collection !== "posts" || e.id === article.id),
    );
    const result = await app.fetch(
      new Request(
        `https://the-rack.vercel.app/studio/preview?collection=${collection}&id=${entry.id}`,
        { headers: { cookie: `__Host-rack_studio=${cookie}` } },
      ),
    );
    const preview = await result.text();
    assert.equal(result.status, 200, preview.slice(0, 1000));
    assert.ok(!preview.includes("Preview unavailable"), preview.slice(0, 1000));
    if (collection === "posts")
      assert.ok(preview.includes("A production integration test"));
  }
  console.log(
    "Production integration passed: authentication, writes, conflicts, MDX and relationship validation, image processing and deletion, CSRF, release checks, publishing, and all three preview types.",
  );
} finally {
  globalThis.fetch = originalFetch;
}
