import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalStore } from "../src/lib/studio/store";
import {
  localReleaseStatus,
  localPublishingBranch,
  startLocalRelease,
} from "../src/lib/studio/releases";
const execute = promisify(execFile);
let directory: string;
let root: string;
let remote: string;
const git = async (...args: string[]) =>
  (await execute("git", args, { cwd: root })).stdout.trim();
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "rack-release-"));
  root = join(directory, "site");
  remote = join(directory, "remote.git");
  await mkdir(root);
  await git("init", "-b", "main");
  await git("config", "user.name", "Studio test");
  await git("config", "user.email", "studio@example.invalid");
  for (const name of ["posts", "issues", "publications"])
    await mkdir(join(root, "src/content", name), { recursive: true });
  await writeFile(join(root, ".gitignore"), ".studio\n");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      scripts: {
        check: 'node -e "process.exit(0)"',
        test: 'node -e "process.exit(0)"',
        build: 'node -e "process.exit(0)"',
      },
    }),
  );
  await writeFile(join(root, "src/content/posts/test.mdx"), "initial article");
  await git("add", ".");
  await git("commit", "-m", "Initial site");
  await git("init", "--bare", remote);
  await git("remote", "add", "origin", remote);
  await git("push", "-u", "origin", "main");
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
describe("local publishing", () => {
  it("checks, commits only content, and pushes the reviewed snapshot", async () => {
    const store = new LocalStore(root);
    await writeFile(
      join(root, "src/content/posts/test.mdx"),
      "updated article",
    );
    const snapshot = await store.snapshot();
    const started = await startLocalRelease(
      store,
      snapshot.revision,
      "Issue update",
    );
    expect(started.state).toBe("running");
    const until = Date.now() + 10_000;
    while (localReleaseStatus().state === "running" && Date.now() < until)
      await new Promise((resolve) => setTimeout(resolve, 25));
    expect(localReleaseStatus()).toMatchObject({ state: "complete" });
    expect(await git("log", "-1", "--format=%s")).toBe("[studio] Issue update");
    expect(await git("status", "--porcelain")).toBe("");
    expect(await git("rev-parse", "HEAD")).toBe(
      await git("rev-parse", "origin/main"),
    );
  }, 15_000);
  it("refuses unrelated staged application changes", async () => {
    await writeFile(join(root, "application.ts"), "export const version = 2;");
    await git("add", "application.ts");
    const store = new LocalStore(root);
    await expect(
      startLocalRelease(
        store,
        (await store.snapshot()).revision,
        "Bad release",
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(await git("diff", "--cached", "--name-only")).toBe("application.ts");
  });
  it("refuses to publish from a feature branch", async () => {
    await git("switch", "-c", "feature/test");
    const store = new LocalStore(root);
    expect(await localPublishingBranch(store)).toBe("feature/test");
    await expect(
      startLocalRelease(
        store,
        (await store.snapshot()).revision,
        "Wrong branch",
      ),
    ).rejects.toThrow("Publishing requires the main branch");
  });
});
