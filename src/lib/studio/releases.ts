import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { acquireWriteLock } from "./lock";
import {
  assertRevision,
  isContentPath,
  isMediaPath,
  StudioError,
} from "./content";
import { GitHubStore, LocalStore } from "./store";
import { baseBranch, editorialBranch, repository } from "./github";
const execute = promisify(execFile);
export interface Release {
  state: "idle" | "running" | "failed" | "complete";
  stage: string;
  url?: string;
  number?: number;
  sha?: string;
  checks?: string[];
  ready?: boolean;
}
let localRelease: Release = { state: "idle", stage: "No release in progress." };
const git = async (root: string, args: string[]) =>
  (
    await execute("git", args, {
      cwd: root,
      timeout: 30_000,
      maxBuffer: 1_000_000,
    })
  ).stdout.trimEnd();
export async function localPublishingBranch(
  store: LocalStore,
): Promise<string | null> {
  try {
    return (
      await execute("git", ["branch", "--show-current"], {
        cwd: store.root,
        timeout: 3000,
        maxBuffer: 10000,
      })
    ).stdout.trimEnd();
  } catch {
    return null;
  }
}
async function assertCheckout(
  root: string,
  branch: string,
  head: string,
): Promise<void> {
  if (
    (await git(root, ["branch", "--show-current"])) !== branch ||
    (await git(root, ["rev-parse", "HEAD"])) !== head
  )
    throw new StudioError(
      409,
      "The checkout changed during publishing. No release was pushed. Review your branch and saved content before trying again.",
    );
}
async function assertContentChanges(
  root: string,
  base: string,
  head: string,
): Promise<void> {
  const changed = (await git(root, ["diff", "--name-only", "-z", base, head]))
    .split("\0")
    .filter(Boolean);
  if (changed.some((path) => !isContentPath(path) && !isMediaPath(path)))
    throw new StudioError(
      409,
      "The release includes application changes. Publish application commits separately before releasing content.",
    );
}
export function localReleaseStatus(): Release {
  return localRelease;
}
export async function startLocalRelease(
  store: LocalStore,
  expected: string,
  title: string,
): Promise<Release> {
  if (localRelease.state === "running")
    throw new StudioError(409, "A release is already running.");
  assertRevision((await store.snapshot()).revision, expected);
  const npmCli = process.env.npm_execpath;
  if (!npmCli)
    throw new StudioError(
      422,
      "Start Studio with npm run studio to enable local publishing.",
    );
  const branch = await localPublishingBranch(store);
  const target = baseBranch();
  if (branch === null)
    throw new StudioError(
      422,
      "Git is unavailable for this workspace. Draft editing remains available; publishing requires a Git checkout.",
    );
  if (branch !== target)
    throw new StudioError(
      422,
      `Publishing requires the ${target} branch. You are on ${branch || "a detached checkout"}. Save your work before switching branches.`,
    );
  const status = await git(store.root, ["status", "--porcelain=v1", "-z"]);
  const paths = status
    .split("\0")
    .filter(Boolean)
    .map((line) => line.slice(3));
  if (paths.some((path) => !isContentPath(path) && !isMediaPath(path)))
    throw new StudioError(
      422,
      "Commit or set aside code changes before publishing content. Studio never stages application code.",
    );
  const unlock = await acquireWriteLock(store.root);
  localRelease = { state: "running", stage: "Checking repository…" };
  void (async () => {
    try {
      await git(store.root, ["fetch", "origin", target]);
      const upstream = await git(store.root, ["rev-parse", `origin/${target}`]);
      const head = await git(store.root, ["rev-parse", "HEAD"]);
      if (head !== upstream) {
        await git(store.root, ["merge-base", "--is-ancestor", upstream, head]);
        const subjects = (
          await git(store.root, ["log", "--format=%s", `${upstream}..HEAD`])
        ).split("\n");
        if (subjects.some((s) => !s.startsWith("[studio] ")))
          throw new StudioError(
            409,
            "Sync application commits with the publishing branch before releasing content.",
          );
      }
      await assertContentChanges(store.root, upstream, head);
      for (const script of ["check", "test", "build"]) {
        localRelease.stage = `Running ${script}…`;
        await execute(process.execPath, [npmCli, "run", script], {
          cwd: store.root,
          timeout: 180_000,
          maxBuffer: 2_000_000,
          env: { ...process.env, RACK_STUDIO_LOCAL: "" },
        });
      }
      assertRevision((await store.snapshot()).revision, expected);
      await assertCheckout(store.root, target, head);
      if (paths.length) {
        localRelease.stage = "Committing validated content…";
        await git(store.root, ["add", "--", ...paths]);
        await git(store.root, ["commit", "-m", `[studio] ${title}`]);
      }
      const releaseHead = await git(store.root, ["rev-parse", "HEAD"]);
      if (
        paths.length &&
        (await git(store.root, ["rev-parse", `${releaseHead}^`])) !== head
      )
        throw new StudioError(
          409,
          "The checkout changed while committing. No release was pushed. Review the retained commit before trying again.",
        );
      await assertCheckout(store.root, target, releaseHead);
      await assertContentChanges(store.root, upstream, releaseHead);
      localRelease.sha = releaseHead;
      localRelease.stage = "Pushing release…";
      await git(store.root, [
        "push",
        "origin",
        `${releaseHead}:refs/heads/${target}`,
      ]);
      localRelease = {
        ...localRelease,
        state: "complete",
        stage: "Release pushed. The hosting provider will build and deploy it.",
      };
    } catch (error) {
      const detail =
        error instanceof StudioError
          ? error.message
          : "Release stopped. Check repository access, Git identity, branch protection, and validation output in the terminal. Saved content has been retained.";
      console.error(
        "Studio release failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      localRelease = { ...localRelease, state: "failed", stage: detail };
    } finally {
      await unlock();
    }
  })();
  return localRelease;
}
interface Pull {
  number: number;
  html_url: string;
  head: { sha: string; ref: string; repo: { full_name: string } | null };
  base: { ref: string; repo: { full_name: string } | null };
  mergeable: boolean | null;
  mergeable_state: string;
}
function isEditorialPull(pull: Pull): boolean {
  const repo = repository().toLowerCase();
  return (
    pull.head.ref === editorialBranch &&
    pull.base.ref === baseBranch() &&
    pull.head.repo?.full_name.toLowerCase() === repo &&
    pull.base.repo?.full_name.toLowerCase() === repo
  );
}
async function currentPull(store: GitHubStore): Promise<Pull | undefined> {
  const rows = await store.github.repo<Pull[]>(
    `/pulls?state=open&base=${encodeURIComponent(baseBranch())}&head=${encodeURIComponent(`${repository().split("/")[0]}:${editorialBranch}`)}`,
  );
  return rows.find(isEditorialPull);
}
export async function submitRelease(
  store: GitHubStore,
  expected: string,
  title: string,
): Promise<Release> {
  assertRevision((await store.snapshot()).revision, expected);
  let pull = await currentPull(store);
  if (!pull)
    pull = await store.github.repo<Pull>("/pulls", {
      method: "POST",
      body: JSON.stringify({
        title,
        head: editorialBranch,
        base: baseBranch(),
        body: "Content release prepared in The Rack Studio.\n\nReview the article and issue changes and the private Studio previews before publishing.",
      }),
    });
  if (!isEditorialPull(pull))
    throw new StudioError(
      409,
      "The release does not match the editorial repository and publishing branch.",
    );
  return {
    state: "running",
    stage:
      "Release submitted. Wait for validation and review the private Studio previews.",
    number: pull.number,
    url: pull.html_url,
    sha: pull.head.sha,
  };
}
export async function remoteReleaseStatus(
  store: GitHubStore,
): Promise<Release> {
  const open = await currentPull(store);
  if (!open) return { state: "idle", stage: "No release submitted." };
  const pull = await store.github.repo<Pull>(`/pulls/${open.number}`);
  if (!isEditorialPull(pull))
    throw new StudioError(
      409,
      "The release target changed. Prepare a release against the configured publishing branch.",
    );
  const checks = await store.github.repo<{
    total_count: number;
    check_runs: {
      app?: { slug: string };
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
    }[];
  }>(`/commits/${pull.head.sha}/check-runs?per_page=100`);
  const statuses = await store.github.repo<{
    state: string;
    statuses: { context: string; state: string }[];
  }>(`/commits/${pull.head.sha}/status`);
  const labels = [
    ...checks.check_runs.map((c) => `${c.name}: ${c.conclusion || c.status}`),
    ...statuses.statuses.map((s) => `${s.context}: ${s.state}`),
  ];
  const verified =
    checks.total_count <= 100 &&
    checks.check_runs.some(
      (c) =>
        c.app?.slug === "github-actions" &&
        c.name === "verify" &&
        c.conclusion === "success",
    );
  const ready =
    verified &&
    checks.check_runs.every(
      (c) =>
        c.status === "completed" &&
        ["success", "neutral", "skipped"].includes(c.conclusion ?? ""),
    ) &&
    statuses.statuses.every((s) => s.state === "success") &&
    pull.mergeable === true &&
    pull.mergeable_state === "clean";
  return {
    state: "running",
    stage: ready
      ? "Checks passed. Review the saved content previews, then publish."
      : "Waiting for passing checks and a mergeable release.",
    number: pull.number,
    url: pull.html_url,
    sha: pull.head.sha,
    checks: labels,
    ready,
  };
}
export async function publishRemote(
  store: GitHubStore,
  expected: string,
): Promise<Release> {
  const status = await remoteReleaseStatus(store);
  if (!status.ready || !status.number || status.sha !== expected)
    throw new StudioError(
      409,
      "The release changed or its checks have not passed. Refresh release status.",
    );
  const merged = await store.github.repo<{ merged: boolean; sha: string }>(
    `/pulls/${status.number}/merge`,
    {
      method: "PUT",
      body: JSON.stringify({ sha: expected, merge_method: "merge" }),
    },
  );
  if (!merged.merged)
    throw new StudioError(409, "GitHub did not merge the release.");

  return {
    state: "complete",
    stage: "Release merged. The hosting provider will build and deploy it.",
    url: status.url,
    sha: merged.sha,
  };
}
