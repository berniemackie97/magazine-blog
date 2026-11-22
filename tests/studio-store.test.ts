import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalStore } from "../src/lib/studio/store";
import { acquireWriteLock } from "../src/lib/studio/lock";
let root: string;
let store: LocalStore;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "rack-studio-"));
  for (const name of ["posts", "issues", "publications"])
    await mkdir(join(root, "src/content", name), { recursive: true });
  store = new LocalStore(root);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
describe("local revision-aware storage", () => {
  it("saves atomically, rejects stale writers, and retains the earlier revision", async () => {
    const path = "src/content/posts/test.mdx";
    const initial = await store.snapshot();
    const saved = await store.save(
      path,
      "first version",
      initial.revision,
      "Create test",
    );
    await store.save(path, "second version", saved.revision, "Edit test");
    await expect(
      store.save(path, "stale version", saved.revision, "Stale edit"),
    ).rejects.toMatchObject({ status: 409 });
    expect((await store.read(path)).toString()).toBe("second version");
    const versions = await store.history(path);
    expect(versions).toHaveLength(1);
    expect((await store.read(path, versions[0]!.id)).toString()).toBe(
      "first version",
    );
  });
  it("retains history after deletion and prevents path traversal in revisions", async () => {
    const path = "src/content/issues/test.json";
    const first = await store.snapshot();
    const second = await store.save(path, "{}", first.revision, "Create");
    await store.save(path, null, second.revision, "Delete");
    expect(await store.history(path)).toHaveLength(1);
    await expect(store.read(path, "../../secret")).rejects.toThrow(
      "Invalid revision",
    );
  });
  it("rejects symlinked content directories", async () => {
    await rm(join(root, "src/content/posts"), { recursive: true });
    await symlink(tmpdir(), join(root, "src/content/posts"));
    await expect(
      store.save(
        "src/content/posts/pwn.mdx",
        "bad",
        (await store.snapshot()).revision,
        "Edit",
      ),
    ).rejects.toThrow("symbolic links");
  });
  it("serializes processes and releases the lock", async () => {
    const release = await acquireWriteLock(root);
    await expect(acquireWriteLock(root)).rejects.toMatchObject({ status: 409 });
    await release();
    const next = await acquireWriteLock(root);
    await next();
    await expect(readFile(join(root, ".studio/write.lock"))).rejects.toThrow();
  });
  it("recovers a lock left by a dead process", async () => {
    await mkdir(join(root, ".studio"));
    await writeFile(join(root, ".studio/write.lock"), "2147483647");
    const release = await acquireWriteLock(root);
    await release();
  });
});
