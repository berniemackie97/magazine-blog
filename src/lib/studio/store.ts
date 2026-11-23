import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
  unlink,
  lstat,
  realpath,
  stat,
} from "node:fs/promises";
import { resolve, dirname, join, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { acquireWriteLock } from "./lock";
import { GitHub, baseBranch, editorialBranch, repository } from "./github";
import {
  assertRevision,
  hash,
  isContentPath,
  isMediaPath,
  StudioError,
  type Snapshot,
} from "./content";

export interface Revision {
  id: string;
  date: string;
  message: string;
}
export interface Store {
  snapshot(): Promise<Snapshot>;
  save(
    path: string,
    content: string | null,
    expected: string,
    message: string,
    binary?: boolean,
  ): Promise<Snapshot>;
  read(path: string, revision?: string): Promise<Buffer>;
  history(path: string): Promise<Revision[]>;
}
export class LocalStore implements Store {
  constructor(readonly root: string) {}
  private async path(path: string): Promise<string> {
    if (!isContentPath(path) && !isMediaPath(path))
      throw new StudioError(400, "Unsupported content path.");
    const root = await realpath(this.root);
    const target = resolve(root, path);
    if (!target.startsWith(root + sep))
      throw new StudioError(400, "Invalid content path.");
    let parent = root;
    for (const segment of path.split("/")) {
      parent = join(parent, segment);
      try {
        if ((await lstat(parent)).isSymbolicLink())
          throw new StudioError(
            400,
            "Content paths cannot contain symbolic links.",
          );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return target;
  }
  async snapshot(): Promise<Snapshot> {
    const files: Record<string, string> = {};
    const media: string[] = [];
    const mediaVersions: string[] = [];
    for (const collection of ["posts", "issues", "publications"]) {
      const directory = `src/content/${collection}`;
      for (const filename of await readdir(resolve(this.root, directory))) {
        const path = `${directory}/${filename}`;
        if (isContentPath(path))
          files[path] = await readFile(await this.path(path), "utf8");
      }
    }
    for (const folder of ["images", "media"]) {
      const directory = `public/${folder}`;
      let filenames: string[];
      try {
        filenames = await readdir(resolve(this.root, directory));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      for (const filename of filenames) {
        const path = `${directory}/${filename}`;
        if (isMediaPath(path)) {
          const info = await stat(await this.path(path));
          media.push(path);
          mediaVersions.push(
            `${path}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`,
          );
        }
      }
    }
    return {
      revision: hash(
        JSON.stringify(Object.entries(files).sort()) +
          mediaVersions.sort().join("\n"),
      ),
      files,
      media,
    };
  }
  async save(
    path: string,
    content: string | null,
    expected: string,
    message: string,
    binary = false,
  ): Promise<Snapshot> {
    const release = await acquireWriteLock(this.root);
    const state = resolve(this.root, ".studio");
    try {
      const before = await this.snapshot();
      assertRevision(before.revision, expected);
      const target = await this.path(path);
      await mkdir(dirname(target), { recursive: true });
      const history = resolve(state, "history", hash(path));
      await mkdir(history, { recursive: true });
      let prior: string | null = null;
      try {
        prior = (await readFile(target)).toString("base64");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const id = randomUUID();
      await writeFile(
        resolve(history, `${id}.json`),
        JSON.stringify({
          id,
          path,
          date: new Date().toISOString(),
          message,
          content: prior,
        }),
        { flag: "wx", mode: 0o600 },
      );
      if (content === null) await unlink(target);
      else {
        const temp = `${target}.${randomUUID()}.tmp`;
        try {
          await writeFile(
            temp,
            binary ? Buffer.from(content, "base64") : content,
            { flag: "wx" },
          );
          await rename(temp, target);
        } finally {
          await unlink(temp).catch(() => undefined);
        }
      }
      return await this.snapshot();
    } finally {
      await release();
    }
  }
  async read(path: string, revision?: string): Promise<Buffer> {
    await this.path(path);
    if (!revision) return readFile(await this.path(path));
    if (!/^[0-9a-f-]{36}$/.test(revision))
      throw new StudioError(400, "Invalid revision.");
    const record = JSON.parse(
      await readFile(
        resolve(this.root, ".studio/history", hash(path), `${revision}.json`),
        "utf8",
      ),
    ) as { content: string | null; path: string };
    if (record.path !== path || record.content === null)
      throw new StudioError(404, "This revision has no previous content.");
    return Buffer.from(record.content, "base64");
  }
  async history(path: string): Promise<Revision[]> {
    await this.path(path);
    const directory = resolve(this.root, ".studio/history", hash(path));
    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const rows = await Promise.all(
      names
        .filter((n) => /^[0-9a-f-]{36}\.json$/.test(n))
        .map(
          async (n) =>
            JSON.parse(
              await readFile(resolve(directory, n), "utf8"),
            ) as Revision & { content: string | null },
        ),
    );
    return rows
      .filter((r) => r.content !== null)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50)
      .map(({ id, date, message }) => ({
        id,
        date,
        message: `Before: ${message}`,
      }));
  }
}
interface Head {
  sha: string;
  tree: { sha: string };
}
interface Tree {
  truncated: boolean;
  tree: { path: string; sha: string; type: string }[];
}
const blobCache = new Map<string, Buffer>();
let blobCacheBytes = 0;
export class GitHubStore implements Store {
  constructor(readonly github: GitHub) {}
  private async branchHead(branch: string): Promise<Head> {
    const ref = await this.github.repo<{ object: { sha: string } }>(
      `/git/ref/heads/${branch}`,
    );
    return this.github.repo<Head>(`/git/commits/${ref.object.sha}`);
  }
  private async head(): Promise<Head> {
    const base = await this.branchHead(baseBranch());
    let draft: Head;
    try {
      draft = await this.branchHead(editorialBranch);
    } catch (error) {
      if (error instanceof StudioError && error.status === 404) return base;
      throw error;
    }
    if (draft.sha === base.sha) return base;
    const comparison = await this.github.repo<{
      ahead_by: number;
      behind_by: number;
    }>(
      `/compare/${encodeURIComponent(baseBranch())}...${encodeURIComponent(editorialBranch)}`,
    );
    return comparison.ahead_by === 0 ? base : draft;
  }
  async sync(): Promise<void> {
    try {
      await this.branchHead(editorialBranch);
    } catch (error) {
      if (error instanceof StudioError && error.status === 404) return;
      throw error;
    }
    await this.github.repo("/merges", {
      method: "POST",
      body: JSON.stringify({
        base: editorialBranch,
        head: baseBranch(),
        commit_message: "Sync production content into editorial workspace",
      }),
    });
  }

  async snapshot(): Promise<Snapshot> {
    return this.snapshotAt(await this.head());
  }
  private async snapshotAt(head: Head): Promise<Snapshot> {
    const tree = await this.github.repo<Tree>(
      `/git/trees/${head.sha}?recursive=1`,
    );
    if (tree.truncated)
      throw new StudioError(
        422,
        "The repository tree exceeds GitHub's recursive listing limit.",
      );
    const paths = tree.tree.filter(
      (e) => e.type === "blob" && isContentPath(e.path),
    );
    const files: Record<string, string> = {};
    // Bound parallel reads to avoid exhausting the API's secondary rate limit.
    for (let i = 0; i < paths.length; i += 8)
      await Promise.all(
        paths.slice(i, i + 8).map(async (e) => {
          files[e.path] = (await this.blob(e.sha)).toString("utf8");
        }),
      );
    return {
      revision: head.sha,
      files,
      media: tree.tree
        .filter((e) => e.type === "blob" && isMediaPath(e.path))
        .map((e) => e.path)
        .sort(),
    };
  }
  private async blob(sha: string): Promise<Buffer> {
    const key = `${repository()}:${sha}`;
    const cached = blobCache.get(key);
    if (cached) return cached;
    const blob = await this.github.repo<{ content: string }>(
      `/git/blobs/${sha}`,
    );
    const bytes = Buffer.from(blob.content, "base64");
    if (bytes.length > 1_200_000)
      throw new StudioError(
        422,
        "A content file exceeds the editor's size limit.",
      );
    blobCache.set(key, bytes);
    blobCacheBytes += bytes.length;
    while (blobCacheBytes > 16_000_000 || blobCache.size > 512) {
      const oldest = blobCache.keys().next().value!;
      blobCacheBytes -= blobCache.get(oldest)!.length;
      blobCache.delete(oldest);
    }
    return bytes;
  }

  async save(
    path: string,
    content: string | null,
    expected: string,
    message: string,
    binary = false,
  ): Promise<Snapshot> {
    if (!isContentPath(path) && !isMediaPath(path))
      throw new StudioError(400, "Unsupported content path.");
    const head = await this.head();
    assertRevision(head.sha, expected);
    let sha: string | null = null;
    if (content !== null)
      sha = (
        await this.github.repo<{ sha: string }>("/git/blobs", {
          method: "POST",
          body: JSON.stringify({
            content,
            encoding: binary ? "base64" : "utf-8",
          }),
        })
      ).sha;
    const tree = await this.github.repo<{ sha: string }>("/git/trees", {
      method: "POST",
      body: JSON.stringify({
        base_tree: head.tree.sha,
        tree: [{ path, mode: "100644", type: "blob", sha }],
      }),
    });
    const commit = await this.github.repo<{ sha: string }>("/git/commits", {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [head.sha] }),
    });
    try {
      await this.github.repo(`/git/ref/heads/${editorialBranch}`);
    } catch (error) {
      if (!(error instanceof StudioError) || error.status !== 404) throw error;
      await this.github.repo("/git/refs", {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/heads/${editorialBranch}`,
          sha: head.sha,
        }),
      });
    }
    await this.github.repo(`/git/refs/heads/${editorialBranch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    return this.snapshotAt({ sha: commit.sha, tree });
  }
  async read(path: string, revision?: string): Promise<Buffer> {
    if (!isContentPath(path) && !isMediaPath(path))
      throw new StudioError(400, "Unsupported content path.");
    if (revision && !/^[a-f0-9]{40}$/.test(revision))
      throw new StudioError(400, "Invalid revision.");
    const ref = revision ?? (await this.head()).sha;
    const data = await this.github.repo<{ content: string }>(
      `/contents/${path}?ref=${ref}`,
    );
    return Buffer.from(data.content, "base64");
  }
  async history(path: string): Promise<Revision[]> {
    if (!isContentPath(path))
      throw new StudioError(400, "Unsupported content path.");
    const head = await this.head();
    const rows = await this.github.repo<
      {
        sha: string;
        commit: { message: string; committer: { date: string } };
      }[]
    >(`/commits?sha=${head.sha}&path=${encodeURIComponent(path)}&per_page=50`);
    return rows.map((r) => ({
      id: r.sha,
      date: r.commit.committer.date,
      message: r.commit.message.split("\n")[0]!,
    }));
  }
}
