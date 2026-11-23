import type { APIContext } from "astro";
import { z } from "astro/zod";
import { compile } from "@mdx-js/mdx";
import { mdxPolicy } from "./mdx-policy";
import { requireIdentity, type Identity } from "./auth";
import { GitHub, baseBranch } from "./github";
import { LocalStore, GitHubStore, type Store } from "./store";
import {
  decode,
  encode,
  entryInput,
  entryPath,
  hash,
  isMediaPath,
  library,
  validateLibrary,
  assertRevision,
  StudioError,
  type Entry,
  type Snapshot,
} from "./content";
import {
  localReleaseStatus,
  localPublishingBranch,
  startLocalRelease,
  submitRelease,
  remoteReleaseStatus,
  publishRemote,
} from "./releases";

export function storeFor(user: Identity): Store {
  return user.local
    ? new LocalStore(process.cwd())
    : new GitHubStore(new GitHub(user.token!));
}
const validatedBodies = new Set<string>();
export async function validateSnapshot(snapshot: Snapshot): Promise<void> {
  const entries = library(snapshot).entries;
  validateLibrary(entries);
  for (const entry of entries)
    if (entry.collection === "posts") {
      const digest = hash(entry.body);
      if (validatedBodies.has(digest)) continue;
      try {
        await compile(entry.body, { remarkPlugins: [mdxPolicy] });
        validatedBodies.add(digest);
        if (validatedBodies.size > 512)
          validatedBodies.delete(validatedBodies.values().next().value!);
      } catch (error) {
        throw new StudioError(
          422,
          `${entry.id}: ${error instanceof Error ? error.message : "Invalid MDX."}`,
        );
      }
    }
}
export async function requestJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new StudioError(400, "Request body is missing.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 12_000_000) {
        await reader.cancel();
        throw new StudioError(413, "The request exceeds the 12 MB limit.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new StudioError(400, "The request is not valid JSON.");
  }
}
async function candidate(
  store: Store,
  input: unknown,
): Promise<{
  snapshot: Snapshot;
  entry: Entry;
  path: string;
  content: string;
}> {
  const data = entryInput.parse(input);
  const path = entryPath(data.collection, data.id);
  const snapshot = await store.snapshot();
  assertRevision(snapshot.revision, data.revision);
  const content = encode(data);
  const entry = decode(path, content);
  await validateSnapshot({
    ...snapshot,
    files: { ...snapshot.files, [path]: content },
  });
  return { snapshot, entry, path, content };
}
export async function handle(context: APIContext): Promise<Response> {
  const user = requireIdentity(context);
  const store = storeFor(user);
  const action = context.params.path;
  const json = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  if (context.request.method === "GET") {
    if (action === "library")
      return json({
        ...library(await store.snapshot()),
        mode: user.local ? "local" : "github",
        login: user.login,
        publishingBranch: baseBranch(),
        checkoutBranch:
          store instanceof LocalStore
            ? await localPublishingBranch(store)
            : undefined,
      });
    if (action === "history") {
      const path = entryPath(
        z
          .enum(["posts", "issues", "publications"])
          .parse(context.url.searchParams.get("collection")),
        z.string().parse(context.url.searchParams.get("id")),
      );
      return json(await store.history(path));
    }
    if (action === "revision") {
      const path = entryPath(
        z
          .enum(["posts", "issues", "publications"])
          .parse(context.url.searchParams.get("collection")),
        z.string().parse(context.url.searchParams.get("id")),
      );
      const version = z.string().parse(context.url.searchParams.get("version"));
      return json(
        decode(path, (await store.read(path, version)).toString("utf8")),
      );
    }
    if (action === "release")
      return json(
        store instanceof GitHubStore
          ? await remoteReleaseStatus(store)
          : localReleaseStatus(),
      );
    if (action === "media") {
      const path = context.url.searchParams.get("path") ?? "";
      if (!isMediaPath(path)) throw new StudioError(400, "Invalid image path.");
      const content = await store.read(path);
      const ext = path.split(".").pop()!.toLowerCase();
      return new Response(new Uint8Array(content), {
        headers: {
          "Content-Type": `image/${ext === "jpg" ? "jpeg" : ext}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    throw new StudioError(404, "Unknown Studio resource.");
  }
  if (context.request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);
  const body = await requestJson(context.request);
  if (action === "save" || action === "create") {
    const { snapshot, entry, path, content } = await candidate(store, body);
    if (action === "create" && snapshot.files[path] !== undefined)
      throw new StudioError(
        409,
        "That URL already exists. Choose another slug.",
      );
    if (action === "save" && snapshot.files[path] === undefined)
      throw new StudioError(
        404,
        "The entry was deleted. Save a copy with another slug.",
      );
    return json(
      library(
        await store.save(
          path,
          content,
          snapshot.revision,
          `${action === "create" ? "Create" : "Edit"} ${entry.collection}: ${entry.id}`,
        ),
      ),
    );
  }
  if (action === "delete") {
    const input = z
      .object({
        collection: z.enum(["posts", "issues", "publications"]),
        id: z.string(),
        revision: z.string(),
      })
      .parse(body);
    const snapshot = await store.snapshot();
    assertRevision(snapshot.revision, input.revision);
    const path = entryPath(input.collection, input.id);
    if (!(path in snapshot.files))
      throw new StudioError(404, "This entry no longer exists.");
    const files = { ...snapshot.files };
    delete files[path];
    await validateSnapshot({ ...snapshot, files });
    return json(
      library(
        await store.save(
          path,
          null,
          snapshot.revision,
          `Delete ${input.collection}: ${input.id}`,
        ),
      ),
    );
  }
  if (action === "restore") {
    const input = z
      .object({
        collection: z.enum(["posts", "issues", "publications"]),
        id: z.string(),
        version: z.string(),
        revision: z.string(),
      })
      .parse(body);
    const path = entryPath(input.collection, input.id);
    const prior = decode(
      path,
      (await store.read(path, input.version)).toString("utf8"),
    );
    if (prior.collection === "posts") prior.data.draft = true;
    if (prior.collection === "issues") prior.data.visibility = "draft";
    const { snapshot, content } = await candidate(store, {
      ...prior,
      revision: input.revision,
    });
    return json(
      library(
        await store.save(
          path,
          content,
          snapshot.revision,
          `Restore ${input.collection}: ${input.id}`,
        ),
      ),
    );
  }
  if (action === "upload") {
    const input = z
      .object({
        name: z.string().max(160),
        content: z.string().max(11_000_000),
        revision: z.string(),
      })
      .parse(body);
    const bytes = Buffer.from(input.content, "base64");
    if (bytes.byteLength > 8_000_000 || !bytes.byteLength)
      throw new StudioError(413, "Choose an image smaller than 8 MB.");
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP";
    if (!png && !jpeg && !webp)
      throw new StudioError(422, "Upload a PNG, JPEG, or WebP image.");
    const { default: sharp } = await import("sharp");
    let image: Buffer;
    try {
      const metadata = await sharp(bytes, {
        limitInputPixels: 40_000_000,
      }).metadata();
      if ((metadata.pages ?? 1) > 1)
        throw new StudioError(
          422,
          "Choose a still image. Animated uploads are not converted automatically.",
        );
      image = await sharp(bytes, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 2400, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (error) {
      if (error instanceof StudioError) throw error;
      throw new StudioError(
        422,
        "This file is not a supported image or exceeds the pixel limit.",
      );
    }
    const name =
      input.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "image";
    const path = `public/media/${name}-${hash(image).slice(0, 12)}.webp`;
    const snapshot = await store.snapshot();
    assertRevision(snapshot.revision, input.revision);
    if (snapshot.media.includes(path))
      return json({ ...library(snapshot), path });
    return json({
      ...library(
        await store.save(
          path,
          image.toString("base64"),
          snapshot.revision,
          `Upload image: ${name}`,
          true,
        ),
      ),
      path,
    });
  }
  if (action === "sync") {
    if (store instanceof GitHubStore) await store.sync();
    return json(library(await store.snapshot()));
  }
  if (action === "delete-media") {
    const input = z
      .object({ path: z.string(), revision: z.string() })
      .parse(body);
    if (!isMediaPath(input.path))
      throw new StudioError(400, "Invalid image path.");
    const snapshot = await store.snapshot();
    assertRevision(snapshot.revision, input.revision);
    if (!snapshot.media.includes(input.path))
      throw new StudioError(404, "This image no longer exists.");
    const url = input.path.replace(/^public/, "");
    if (Object.values(snapshot.files).some((content) => content.includes(url)))
      throw new StudioError(
        422,
        "This image is used in saved content. Remove those references before deleting it.",
      );
    return json(
      library(
        await store.save(
          input.path,
          null,
          snapshot.revision,
          `Delete image: ${input.path}`,
        ),
      ),
    );
  }
  if (action === "validate") {
    const snapshot = await store.snapshot();
    await validateSnapshot(snapshot);
    return json({ valid: true });
  }
  if (action === "release") {
    const input = z
      .object({
        revision: z.string(),
        title: z.string().trim().min(1).max(120),
      })
      .parse(body);
    const snapshot = await store.snapshot();
    assertRevision(snapshot.revision, input.revision);
    await validateSnapshot(snapshot);
    return json(
      store instanceof GitHubStore
        ? await submitRelease(store, input.revision, input.title)
        : await startLocalRelease(
            store as LocalStore,
            input.revision,
            input.title,
          ),
    );
  }
  if (action === "publish") {
    const input = z.object({ revision: z.string() }).parse(body);
    if (!(store instanceof GitHubStore))
      throw new StudioError(400, "Local publishing uses the release action.");
    return json(await publishRemote(store, input.revision));
  }
  throw new StudioError(404, "Unknown Studio action.");
}
