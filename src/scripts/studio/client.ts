import { SourceEditor } from "./editor";
import type {
  Collection,
  Entry,
  Fields,
  Library,
} from "../../lib/studio/content";
import type { Release } from "../../lib/studio/releases";
import {
  blocks,
  coverFields,
  defaults,
  formats,
  issueFields,
  postFields,
  publicationFields,
  templates,
  themeFields,
  type Field,
} from "./fields";
interface Workspace extends Library {
  mode: "local" | "github";
  login: string;
  publishingBranch: string;
  checkoutBranch?: string | null;
}
type View = Collection | "media" | "release";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const input = (id: string) => $<HTMLInputElement>(id);
const clone = <T>(value: T): T => structuredClone(value);
const labels = {
  posts: "article",
  issues: "issue",
  publications: "publication",
};
const plural = {
  posts: "Articles",
  issues: "Issues",
  publications: "Publications",
  media: "Media library",
  release: "Release desk",
};
let sourceEditor: SourceEditor;
let workspace: Workspace;
let view: View = "posts";
let current: Entry | undefined;
let creating = false;
let manualRecovery = false;
let dirty = false;
let generation = 0;
let saving: Promise<boolean> | undefined;
let autosave: ReturnType<typeof setTimeout> | undefined;
let release: Release | undefined;
let releaseAction = false;
let releaseEpoch = 0;
let poll: ReturnType<typeof setTimeout> | undefined;
let restored: { entry: Entry; saved: number } | undefined;
const dialog = $<HTMLDialogElement>("studio-dialog");
let dialogSubmit: (() => Promise<void> | void) | undefined;

async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/studio/${path}`, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || `Request failed (${response.status}).`);
  return result as T;
}
function notice(message: string, error = false): void {
  const node = $("notice");
  node.textContent = message;
  node.classList.toggle("error", error);
  node.hidden = !message;
}
function failure(error: unknown): void {
  notice(
    error instanceof Error
      ? error.message
      : "The request failed. Your edits are preserved.",
    true,
  );
}
function status(message: string): void {
  $("save-status").textContent = message;
}
function recoveryKey(): string {
  return `rack-studio:${workspace.login}:${current?.collection}:${current?.id}`;
}
function recoverable(): void {
  if (!current) return;
  try {
    localStorage.setItem(
      recoveryKey(),
      JSON.stringify({ entry: current, saved: Date.now() }),
    );
  } catch {
    status("Browser recovery unavailable. Save frequently.");
  }
}
function changed(): void {
  if (!current) return;
  dirty = true;
  generation++;
  recoverable();
  status("Unsaved changes");
  clearTimeout(autosave);
  if (!manualRecovery) autosave = setTimeout(() => void save(false), 1600);
  $("editor-title").textContent = String(
    current.data.headline ||
      current.data.title ||
      current.data.name ||
      "Untitled",
  );
}
function accept(result: Library): void {
  workspace = { ...workspace, ...result };
  for (const collection of ["posts", "issues", "publications"] as const)
    $("count-" + collection).textContent = String(
      workspace.entries.filter((e) => e.collection === collection).length,
    );
  $("workspace-detail").textContent =
    workspace.mode === "local"
      ? "Local files · publishing to " + workspace.publishingBranch
      : "GitHub editorial workspace · publishing to " +
        workspace.publishingBranch;
}
async function load(): Promise<void> {
  const data = await api<Workspace>("library");
  workspace = data;
  accept(data);
  $("connection").textContent =
    data.mode === "local" ? "● Local workspace" : "● Connected to GitHub";
  $("publishing-context").textContent =
    data.mode === "local"
      ? "Local drafts. Saving here does not change the live site. Use the Release desk to validate and publish."
      : "Editorial drafts. Saving here does not change the live site. Review and publish a release when ready.";
  renderList();
  input("new-entry").disabled = false;
  document
    .querySelectorAll<HTMLButtonElement>("[data-view]")
    .forEach((button) => {
      button.disabled = false;
    });
}
function draft(entry: Entry): boolean {
  return entry.collection === "posts"
    ? !!entry.data.draft
    : entry.collection === "issues"
      ? entry.data.visibility === "draft"
      : false;
}
function title(entry: Entry): string {
  return String(entry.data.headline || entry.data.title || entry.data.name);
}
function publication(entry: Entry): Entry | undefined {
  return workspace.entries.find(
    (e) => e.collection === "publications" && e.id === entry.data.publication,
  );
}
function renderList(): void {
  if (!workspace || !["posts", "issues", "publications"].includes(view)) return;
  const search = input("search").value.toLowerCase();
  const filter = input("status-filter").value;
  const entries = workspace.entries
    .filter((e) => e.collection === view)
    .filter((e) =>
      `${title(e)} ${publication(e)?.data.name ?? ""} ${e.data.tags ?? ""}`
        .toLowerCase()
        .includes(search),
    )
    .filter(
      (e) => filter === "all" || (filter === "draft" ? draft(e) : !draft(e)),
    );
  entries.sort((a, b) =>
    input("sort").value === "title"
      ? title(a).localeCompare(title(b))
      : String(b.data.publishedAt || b.data.date || b.id).localeCompare(
          String(a.data.publishedAt || a.data.date || a.id),
        ),
  );
  const list = $("entry-list");
  list.replaceChildren();
  if (!entries.length) {
    list.append(
      el(
        "p",
        search || filter !== "all"
          ? "No matches. Try another search or filter."
          : `Your next ${labels[view as Collection]} starts here. Create one to get going.`,
        "empty-state",
      ),
    );
    return;
  }
  for (const entry of entries) {
    const button = el("button", undefined, "entry-card");
    button.type = "button";
    const emblem = el(
      "span",
      view === "posts" ? "Aa" : view === "issues" ? "№" : "R.",
      "entry-emblem",
    );
    emblem.setAttribute("aria-hidden", "true");
    const copy = el("div", undefined, "entry-copy");
    copy.append(
      el(
        "span",
        `${publication(entry)?.data.name ?? (entry.collection === "publications" ? "Publication" : "Independent")} ${entry.data.format ? " / " + String(entry.data.format).replaceAll("-", " ") : ""}`,
        "entry-overline",
      ),
      el("h3", title(entry)),
      el(
        "p",
        String(
          entry.data.dek ||
            entry.data.description ||
            entry.data.coverDek ||
            entry.data.editorNote ||
            "Ready for your next edit.",
        ),
      ),
    );
    const meta = el("div", undefined, "entry-meta");
    meta.append(
      el(
        "span",
        draft(entry)
          ? "Draft"
          : entry.collection === "posts"
            ? "Ready"
            : entry.data.status === "open"
              ? "In progress"
              : "Ready",
        "badge" + (draft(entry) ? "" : " ready"),
      ),
    );
    const date = String(
      entry.data.updatedAt || entry.data.publishedAt || entry.data.date || "",
    );
    if (date) {
      const time = el("time", date);
      time.dateTime = date;
      meta.append(time);
    }
    button.append(emblem, copy, meta, el("span", "↗", "entry-arrow"));
    button.addEventListener("click", () => void openEntry(entry));
    list.append(button);
  }
}
async function leave(): Promise<boolean> {
  clearTimeout(autosave);
  if (manualRecovery && dirty) {
    notice(
      "Review and save the recovered edits before leaving this entry.",
      true,
    );
    return false;
  }
  if (dirty && !(await save(true))) return false;
  return true;
}
async function showView(next: View): Promise<void> {
  if (!(await leave())) return;
  current = undefined;
  view = next;
  notice("");
  $("editor").hidden = true;
  $("listing").hidden = !["posts", "issues", "publications"].includes(next);
  $("media-panel").hidden = next !== "media";
  $("release-panel").hidden = next !== "release";
  $("view-title").textContent = plural[next];
  $("new-entry").hidden = next === "media" || next === "release";
  $("new-entry").textContent = `+ New ${labels[next as Collection] || "entry"}`;
  document
    .querySelectorAll<HTMLButtonElement>("[data-view]")
    .forEach((button) =>
      button.setAttribute(
        "aria-current",
        button.dataset.view === next ? "page" : "false",
      ),
    );
  const introductions = {
    posts: [
      "Stories worth putting on paper.",
      "Draft, refine, and prepare your next release.",
    ],
    issues: [
      "Build the next edition.",
      "Bring your articles together into something worth collecting.",
    ],
    publications: [
      "Every publication has a point of view.",
      "Shape its identity, sections, covers, and reading experience.",
    ],
  };
  if (next in introductions) {
    const [heading, description] = introductions[next as Collection];
    $("collection-heading").textContent = heading!;
    $("collection-description").textContent = description!;
    renderList();
  }
  if (next === "media") renderMedia();
  if (next === "release") {
    renderReleaseSummary();
    if (workspace.mode === "local") {
      try {
        workspace.checkoutBranch = (
          await api<{ checkoutBranch: string | null }>("publishing")
        ).checkoutBranch;
      } catch {
        workspace.checkoutBranch = null;
      }
    }
    $("release-explanation").textContent =
      workspace.mode === "local"
        ? workspace.checkoutBranch === null
          ? "Git is unavailable. You can keep editing drafts; publishing requires a Git checkout."
          : workspace.checkoutBranch !== workspace.publishingBranch
            ? `Your drafts are saved locally. Publishing requires the ${workspace.publishingBranch} branch; this checkout is ${workspace.checkoutBranch || "detached"}. Save your work and switch to ${workspace.publishingBranch}, then restart Studio. No content has been published.`
            : `Checks, tests, and builds the site, then commits content and pushes to ${workspace.publishingBranch}. Vercel deploys that push to the live site.`
        : `Opens a content release against ${workspace.publishingBranch}. Publishing stays blocked until validation passes.`;
    await refreshRelease();
  }
}
function get(data: Fields, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === "object"
          ? (value as Fields)[part]
          : undefined,
      data,
    );
}
function set(data: Fields, key: string, value: unknown): void {
  const parts = key.split(".");
  let target = data;
  for (const part of parts.slice(0, -1)) {
    if (!target[part]) target[part] = {};
    target = target[part] as Fields;
  }
  if (value === undefined) delete target[parts.at(-1)!];
  else target[parts.at(-1)!] = value;
}
function fieldNode(spec: Field, data: Fields, update: () => void): HTMLElement {
  const label = el(
    "label",
    undefined,
    `field${spec.wide ? " wide" : ""}${spec.type === "checkbox" ? " check-field" : ""}`,
  );
  const text = el("span", spec.label);
  let control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if (spec.type === "select") {
    control = el("select");
    let options = (spec.options ?? []).map((v) => ({
      value: v,
      label: v.replaceAll("-", " "),
    }));
    if (spec.key === "publication")
      options = workspace.entries
        .filter((e) => e.collection === "publications")
        .map((e) => ({ value: e.id, label: title(e) }));
    if (spec.key === "issue")
      options = [
        { value: "", label: "Standalone article" },
        ...workspace.entries
          .filter(
            (e) =>
              e.collection === "issues" &&
              e.data.publication === data.publication,
          )
          .map((e) => ({ value: String(e.data.slug), label: title(e) })),
      ];
    if (spec.key === "section")
      options = (
        (workspace.entries.find(
          (e) => e.collection === "publications" && e.id === data.publication,
        )?.data.sections ?? []) as { id: string; label: string }[]
      ).map((s) => ({ value: s.id, label: s.label }));
    for (const item of options) {
      const option = el("option", item.label);
      option.value = item.value;
      control.append(option);
    }
  } else if (["textarea", "lines"].includes(spec.type ?? ""))
    control = el("textarea");
  else {
    control = el("input");
    control.type = ["date", "number", "checkbox", "color"].includes(
      spec.type ?? "",
    )
      ? spec.type!
      : "text";
    if (spec.type === "number") control.step = "1";
    if (spec.readonly) control.readOnly = true;
  }
  const value = get(data, spec.key);
  if (spec.type === "checkbox") (control as HTMLInputElement).checked = !!value;
  else
    control.value = Array.isArray(value)
      ? value.join(spec.type === "lines" ? "\n" : ", ")
      : String(value ?? "");
  control.name = spec.key;
  control.addEventListener(
    spec.type === "checkbox" || spec.type === "select" ? "change" : "input",
    () => {
      let value: unknown = control.value;
      if (spec.type === "checkbox")
        value = (control as HTMLInputElement).checked;
      else if (spec.type === "number")
        value = control.value === "" ? undefined : Number(control.value);
      else if (spec.type === "tags" || spec.type === "lines")
        value = control.value
          .split(spec.type === "tags" ? "," : "\n")
          .map((v) => v.trim())
          .filter(Boolean);
      else if (["updatedAt", "issue"].includes(spec.key) && value === "")
        value = undefined;
      set(data, spec.key, value);
      update();
      if (spec.key === "publication" && current && data === current.data) {
        const pub = workspace.entries.find(
          (e) => e.collection === "publications" && e.id === value,
        );
        if (current.collection === "posts") {
          data.section =
            (pub?.data.sections as { id: string }[])?.[0]?.id ?? "";
          delete data.issue;
        }
        renderFields();
      }
    },
  );
  label.append(text, control);
  if (spec.help) label.append(el("small", spec.help));
  return label;
}
function renderFields(): void {
  if (!current) return;
  const fields = $("fields");
  fields.replaceChildren();
  const specs =
    current.collection === "posts"
      ? postFields
      : current.collection === "issues"
        ? issueFields
        : publicationFields;
  for (const spec of specs)
    fields.append(fieldNode(spec, current.data, changed));
  if (current.collection === "publications") {
    const sections = el("div", undefined, "field wide");
    sections.append(el("span", "Publication sections"));
    const rows = current.data.sections as { id: string; label: string }[];
    rows.forEach((section, index) => {
      const row = el("div", undefined, "section-row");
      for (const key of ["id", "label"] as const) {
        const control = el("input");
        control.value = section[key];
        control.placeholder = key === "id" ? "section-id" : "Section name";
        control.setAttribute("aria-label", `Section ${index + 1} ${key}`);
        control.addEventListener("input", () => {
          section[key] = control.value;
          changed();
        });
        row.append(control);
      }
      const remove = el("button", "Remove", "text-button danger");
      remove.type = "button";
      remove.disabled = rows.length <= 1;
      remove.addEventListener("click", () => {
        rows.splice(index, 1);
        changed();
        renderFields();
      });
      row.append(remove);
      sections.append(row);
    });
    const add = el("button", "+ Add section", "text-button");
    add.type = "button";
    add.addEventListener("click", () => {
      rows.push({ id: `section-${rows.length + 1}`, label: "New section" });
      changed();
      renderFields();
    });
    sections.append(add);
    fields.append(sections);
    for (const [heading, specs] of [
      ["Cover design", coverFields],
      ["Reading theme", themeFields],
    ] as const) {
      const details = el("details", undefined, "field-group");
      details.append(el("summary", heading));
      const grid = el("div", undefined, "metadata-grid");
      for (const spec of specs)
        grid.append(fieldNode(spec, current.data, changed));
      details.append(grid);
      fields.append(details);
    }
  }
  $("body-editor").hidden = current.collection !== "posts";
  $("issue-articles").hidden = current.collection !== "issues";
  if (current.collection === "issues") renderIssueArticles();
}
function renderIssueArticles(): void {
  if (!current) return;
  const node = $("issue-articles");
  node.replaceChildren(el("h3", "Articles in this issue"));
  const articles = workspace.entries
    .filter(
      (e) =>
        e.collection === "posts" &&
        e.data.publication === current!.data.publication &&
        e.data.issue === current!.data.slug,
    )
    .sort((a, b) => Number(a.data.order) - Number(b.data.order));
  if (!articles.length)
    node.append(
      el(
        "p",
        "Assign an article to this issue from its article editor.",
        "muted",
      ),
    );
  for (const article of articles) {
    const row = el("div", undefined, "issue-row");
    row.append(
      el("span", title(article)),
      el("small", `Order ${article.data.order ?? 0}`, "muted"),
      el("span", draft(article) ? "Draft" : "Ready", "badge"),
    );
    const open = el("button", "Edit article →", "text-button");
    open.type = "button";
    open.addEventListener("click", () => void openEntry(article));
    row.append(open);
    node.append(row);
  }
}
async function openEntry(entry: Entry, isNew = false): Promise<void> {
  if (!(await leave())) return;
  current = clone(entry);
  manualRecovery = false;
  view = entry.collection;
  $("view-title").textContent = plural[view];
  document
    .querySelectorAll<HTMLButtonElement>("[data-view]")
    .forEach((button) =>
      button.setAttribute(
        "aria-current",
        button.dataset.view === view ? "page" : "false",
      ),
    );
  creating = isNew;
  dirty = isNew;
  generation++;
  $("listing").hidden = true;
  $("editor").hidden = false;
  $("media-panel").hidden = true;
  $("release-panel").hidden = true;
  $("editor-kind").textContent = labels[entry.collection].toUpperCase();
  $("editor-title").textContent = title(entry);
  $("editor-url").textContent =
    entry.collection === "posts"
      ? `/posts/${entry.id}`
      : entry.collection === "issues"
        ? `/issues/${entry.data.publication}/${entry.data.slug}`
        : `/publications/${entry.id}`;
  $("back").textContent = `← Back to ${plural[entry.collection].toLowerCase()}`;
  $("history").hidden = isNew;
  $("delete-entry").hidden = isNew;
  renderFields();
  sourceEditor.load(entry.body);
  wordCount();
  status(isNew ? "New draft" : "All changes saved");
  notice("");
  $("recovery").hidden = true;
  restored = undefined;
  try {
    const raw = localStorage.getItem(recoveryKey());
    if (raw) {
      const found = JSON.parse(raw) as { entry: Entry; saved: number };
      if (
        Date.now() - found.saved < 7 * 86400000 &&
        (JSON.stringify(found.entry.data) !== JSON.stringify(entry.data) ||
          found.entry.body !== entry.body)
      ) {
        restored = found;
        $("recovery").hidden = false;
      }
    }
  } catch {
    /* Storage may be disabled by the browser. */
  }
  $("editor-title").tabIndex = -1;
  $("editor-title").focus();
  window.scrollTo({ top: 0 });
}
async function save(manual: boolean): Promise<boolean> {
  clearTimeout(autosave);
  if (!current || !dirty) return true;
  if (restored) {
    if (manual)
      notice("Recover or discard the browser draft before saving.", true);
    return false;
  }
  if (saving) {
    const saved = await saving;
    return saved && dirty ? save(manual) : saved;
  }
  if (manualRecovery && !manual) return false;
  if (manual) manualRecovery = false;
  const captured = clone(current);
  const version = generation;
  const create = creating;
  status("Saving…");
  saving = (async () => {
    try {
      const result = await api<Library>(create ? "create" : "save", {
        ...captured,
        revision: workspace.revision,
      });
      accept(result);
      creating = false;
      $("history").hidden = false;
      $("delete-entry").hidden = false;
      if (version === generation) {
        dirty = false;
        try {
          localStorage.removeItem(recoveryKey());
        } catch {}
        status("All changes saved");
      } else {
        status("Saving newer changes…");
        autosave = setTimeout(() => void save(false), 500);
      }
      if (manual) notice("Changes saved to your workspace.");
      else if ($("notice").classList.contains("error")) notice("");
      return true;
    } catch (error) {
      recoverable();
      status("Not saved · browser recovery retained");
      if (manual) failure(error);
      else
        notice(
          error instanceof Error
            ? error.message
            : "Autosave failed. Your browser recovery is retained.",
          true,
        );
      return false;
    } finally {
      saving = undefined;
    }
  })();
  return saving;
}
function modal(
  title: string,
  submit: string,
  action?: () => Promise<void> | void,
): void {
  dialog.classList.remove("preview-dialog", "compare-dialog");
  $("dialog-title").textContent = title;
  $("dialog-submit").textContent = submit;
  $("dialog-submit").hidden = !action;
  $("dialog-body").replaceChildren();
  dialogSubmit = action;
  dialog.showModal();
}
function createEntry(): void {
  const collection = view as Collection;
  if (
    collection !== "publications" &&
    !workspace.entries.some((e) => e.collection === "publications")
  ) {
    notice("Create a publication first so your content has a home.", true);
    return;
  }
  const data: Fields = { id: "", format: "feature" };
  modal(`New ${labels[collection]}`, "Create draft", async () => {
    const id = String(data.id).trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
      throw new Error("Use a lowercase slug with words separated by hyphens.");
    if (
      workspace.entries.some((e) => e.collection === collection && e.id === id)
    )
      throw new Error("That slug already exists.");
    const pub = workspace.entries.find((e) => e.collection === "publications");
    const fields = defaults(
      collection,
      pub?.id,
      (pub?.data.sections as { id: string }[])?.[0]?.id,
    );
    if (collection === "posts") fields.format = data.format;
    if (collection === "issues") fields.slug = id;
    dialog.close();
    await openEntry(
      {
        collection,
        id,
        data: fields,
        body:
          collection === "posts" ? (templates[String(data.format)] ?? "") : "",
        revision: "",
      },
      true,
    );
  });
  $("dialog-body").append(
    fieldNode(
      {
        key: "id",
        label: "URL slug",
        help: "A stable identifier. For example: building-a-packet-inspector",
      },
      data,
      () => {},
    ),
  );
  if (collection === "posts")
    $("dialog-body").append(
      fieldNode(
        {
          key: "format",
          label: "Starting template",
          type: "select",
          options: formats,
        },
        data,
        () => {},
      ),
    );
}
function wordCount(): void {
  const words = sourceEditor.value.trim().split(/\s+/).filter(Boolean).length;
  $("word-count").textContent =
    `${words.toLocaleString()} words · ${Math.max(1, Math.ceil(words / 200))} min`;
}
function insert(text: string, wrap?: string): void {
  sourceEditor.insert(text, wrap);
}
function attribute(value: unknown): string {
  return `"${String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}"`;
}
function insertBlock(): void {
  let selected = blocks[0]!;
  let data: Fields = {};
  const render = () => {
    const node = $("dialog-body");
    node.replaceChildren();
    const choose = el("label", undefined, "field");
    choose.append(el("span", "Block type"));
    const select = el("select");
    for (const block of blocks) {
      const option = el("option", block.label);
      option.value = block.name;
      select.append(option);
    }
    select.value = selected.name;
    select.addEventListener("change", () => {
      selected = blocks.find((b) => b.name === select.value)!;
      data = {};
      render();
    });
    choose.append(select);
    node.append(choose);
    for (const field of selected.fields) {
      if (field.options) data[field.key] ??= field.options[0];
      node.append(fieldNode(field, data, () => {}));
    }
    if (selected.children) {
      data.children ??= selected.children;
      node.append(
        fieldNode(
          { key: "children", label: "Content", type: "textarea" },
          data,
          () => {},
        ),
      );
    }
  };
  modal("Insert a content block", "Insert block", () => {
    const attrs = selected.fields
      .filter((f) => data[f.key])
      .map((f) => `${f.key}=${attribute(data[f.key])}`)
      .join(" ");
    const tag = `<${selected.name}${attrs ? " " + attrs : ""}`;
    insert(
      selected.children
        ? `\n${tag}>\n${String(data.children)}\n</${selected.name}>\n`
        : `\n${tag} />\n`,
    );
    dialog.close();
  });
  render();
}
function mediaImage(path: string): HTMLImageElement {
  const image = el("img");
  image.src = `/api/studio/media?path=${encodeURIComponent(path)}`;
  image.alt = path.split("/").pop()!;
  image.loading = "lazy";
  return image;
}
function renderMedia(): void {
  const grid = $("media-grid");
  grid.replaceChildren();
  if (!workspace.media.length) {
    grid.append(
      el(
        "p",
        "Your image library is empty. Upload your first image to get started.",
        "empty-state",
      ),
    );
    return;
  }
  for (const path of workspace.media) {
    const card = el("div", undefined, "media-card");
    const url = path.replace(/^public/, "");
    const copy = el("button", "Copy image path", "button secondary");
    copy.type = "button";
    copy.addEventListener(
      "click",
      () =>
        void navigator.clipboard
          .writeText(url)
          .then(() => notice("Image path copied."))
          .catch(failure),
    );
    const remove = el("button", "Delete image", "text-button danger");
    remove.type = "button";
    remove.addEventListener("click", () => {
      if (
        !confirm(
          "Delete this image? Images referenced by saved content cannot be deleted.",
        )
      )
        return;
      void busy(remove, async () => {
        accept(
          await api<Library>("delete-media", {
            path,
            revision: workspace.revision,
          }),
        );
        renderMedia();
        notice("Image deleted.");
      });
    });
    card.append(mediaImage(path), el("p", path.split("/").pop()), copy, remove);
    grid.append(card);
  }
}
function imagePicker(): void {
  const data: Fields = { src: "", alt: "", caption: "" };
  modal("Add an image", "Insert image", () => {
    if (!data.src || !data.alt)
      throw new Error(
        "Choose an image and add a description for readers using assistive technology.",
      );
    insert(
      `\n<CaptionedFigure src=${attribute(data.src)} alt=${attribute(data.alt)}>\n${String(data.caption)}\n</CaptionedFigure>\n`,
    );
    dialog.close();
  });
  const select = el("select");
  select.setAttribute("aria-label", "Choose image");
  const placeholder = el("option", "Choose an uploaded image");
  placeholder.value = "";
  select.append(placeholder);
  for (const path of workspace.media) {
    const option = el("option", path.split("/").pop());
    option.value = path.replace(/^public/, "");
    select.append(option);
  }
  select.addEventListener("change", () => {
    data.src = select.value;
  });
  $("dialog-body").append(
    select,
    fieldNode(
      {
        key: "alt",
        label: "Image description",
        help: "Describe what is useful to someone who cannot see the image.",
      },
      data,
      () => {},
    ),
    fieldNode({ key: "caption", label: "Caption" }, data, () => {}),
  );
  const label = el(
    "label",
    "Upload a new image",
    "button secondary upload-label",
  );
  const upload = el("input");
  upload.type = "file";
  upload.accept = "image/png,image/jpeg,image/webp";
  upload.hidden = true;
  upload.addEventListener(
    "change",
    () =>
      void uploadFiles(upload.files)
        .then((paths) => {
          if (paths[0]) {
            const option = el("option", paths[0].split("/").pop());
            option.value = paths[0].replace(/^public/, "");
            select.append(option);
            select.value = option.value;
            data.src = option.value;
          }
        })
        .catch(failure),
  );
  label.append(upload);
  $("dialog-body").append(label);
}
async function uploadFiles(files: FileList | null): Promise<string[]> {
  if (!files?.length) return [];
  const paths: string[] = [];
  if (dirty && !(await save(true)))
    throw new Error("Save the current article before uploading images.");
  for (const file of Array.from(files)) {
    if (file.size > 8_000_000)
      throw new Error(`${file.name} exceeds the 8 MB upload limit.`);
    notice(`Uploading ${file.name}…`);
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () =>
        reject(new Error("The browser could not read this file."));
      reader.onload = () => resolve(String(reader.result).split(",")[1]!);
      reader.readAsDataURL(file);
    });
    const result = await api<Library & { path: string }>("upload", {
      name: file.name,
      content,
      revision: workspace.revision,
    });
    accept(result);
    paths.push(result.path);
  }
  notice(`${paths.length} image${paths.length === 1 ? "" : "s"} uploaded.`);
  renderMedia();
  return paths;
}
async function history(): Promise<void> {
  if (!current || creating) return;
  clearTimeout(autosave);
  if (saving) await saving;
  if (dirty) recoverable();
  const entry = clone(current);
  const rows = await api<{ id: string; date: string; message: string }[]>(
    `history?collection=${entry.collection}&id=${entry.id}`,
  );
  modal("Revision history", "", undefined);
  if (!rows.length)
    $("dialog-body").append(
      el(
        "p",
        "No earlier revisions yet. Saved changes will appear here.",
        "muted",
      ),
    );
  for (const revision of rows) {
    const row = el("div", undefined, "history-row");
    const restore = el("button", "Restore as draft", "button secondary");
    restore.type = "button";
    restore.addEventListener("click", () => {
      if (
        !confirm(
          "Restore this revision? Saved content stays in revision history. Unsaved edits stay in browser recovery.",
        )
      )
        return;
      restore.disabled = true;
      void api<Library>("restore", {
        collection: entry.collection,
        id: entry.id,
        version: revision.id,
        revision: workspace.revision,
      })
        .then(async (result) => {
          accept(result);
          dialog.close();
          dirty = false;
          manualRecovery = false;
          clearTimeout(autosave);
          await openEntry(
            result.entries.find(
              (e) => e.collection === entry.collection && e.id === entry.id,
            )!,
          );
          notice("Revision restored as a draft. Review it before publishing.");
        })
        .catch(failure)
        .finally(() => {
          restore.disabled = false;
        });
    });
    const compare = el("button", "Compare", "text-button");
    compare.type = "button";
    compare.addEventListener(
      "click",
      () =>
        void busy(compare, async () => {
          const prior = await api<Entry>(
            `revision?collection=${entry.collection}&id=${entry.id}&version=${revision.id}`,
          );
          dialog.close();
          modal("Compare saved revisions", "", undefined);
          const grid = el("div", undefined, "revision-compare");
          for (const [label, version] of [
            ["Current workspace", entry],
            ["Earlier revision", prior],
          ] as const) {
            const column = el("section");
            column.append(
              el("h3", label),
              el(
                "pre",
                `${JSON.stringify(version.data, null, 2)}\n\n${version.body}`,
              ),
            );
            grid.append(column);
          }
          $("dialog-body").append(grid);
          dialog.classList.add("compare-dialog");
        }),
    );
    row.append(
      restore,
      compare,
      el("p", revision.message),
      el("small", new Date(revision.date).toLocaleString()),
    );
    $("dialog-body").append(row);
  }
}
async function preview(): Promise<void> {
  if (!current || !(await save(true))) return;
  const url = `/studio/preview?collection=${current.collection}&id=${encodeURIComponent(current.id)}&revision=${workspace.revision}`;
  modal("Saved content preview", "", undefined);
  dialog.classList.add("preview-dialog");
  const tools = el("div", undefined, "preview-tools");
  const state = el("span", "Loading saved preview…");
  state.setAttribute("role", "status");
  const fullPage = el("a", "Open full page ↗", "button secondary");
  fullPage.href = url;
  fullPage.target = "_blank";
  fullPage.rel = "noopener noreferrer";
  tools.append(state, fullPage);
  const frame = el("iframe");
  frame.title = "Content preview";
  frame.addEventListener("load", () => {
    state.textContent =
      frame.contentDocument?.title === "Preview unavailable"
        ? "Preview unavailable. Open the full page to read the error."
        : "Saved preview · not published";
  });
  frame.src = url;
  $("dialog-body").append(tools, frame);
}
function renderReleaseSummary(): void {
  const node = $("release-summary");
  node.replaceChildren(el("h3", "Workspace at a glance"));
  for (const collection of ["posts", "issues", "publications"] as const) {
    const entries = workspace.entries.filter(
      (e) => e.collection === collection,
    );
    node.append(
      el(
        "p",
        `${entries.length} ${plural[collection].toLowerCase()}${collection !== "publications" ? ` · ${entries.filter(draft).length} drafts` : ""}`,
      ),
    );
  }
}
function renderRelease(value: Release): void {
  release = value;
  $("release-message").textContent = value.stage;
  const list = $("release-checks");
  list.replaceChildren(...(value.checks ?? []).map((check) => el("li", check)));
  const link = $<HTMLAnchorElement>("release-link");
  link.hidden = !value.url;
  if (value.url) link.href = value.url;
  $("publish-release").hidden = !value.ready;
  input("submit-release").disabled =
    releaseAction ||
    value.state === "running" ||
    (workspace.mode === "local" &&
      workspace.checkoutBranch !== workspace.publishingBranch);
  $("submit-release").textContent = releaseAction
    ? "Preparing release…"
    : workspace.mode === "local"
      ? "Publish to live site"
      : "Prepare release";
  clearTimeout(poll);
  if (value.state === "running" && view === "release" && !releaseAction)
    poll = setTimeout(() => void refreshRelease(), 8000);
}
async function refreshRelease(): Promise<void> {
  const epoch = releaseEpoch;
  try {
    const value = await api<Release>("release");
    if (epoch === releaseEpoch && !releaseAction) renderRelease(value);
  } catch (error) {
    failure(error);
  }
}
async function performRelease(action: "release" | "publish"): Promise<void> {
  if (releaseAction) return;
  releaseAction = true;
  releaseEpoch++;
  notice("");
  const payload =
    action === "publish"
      ? { revision: release?.sha }
      : { revision: workspace.revision, title: input("release-title").value };
  renderRelease({
    state: "running",
    stage:
      action === "publish"
        ? "Publishing the reviewed release…"
        : "Validating and preparing the release…",
  });
  try {
    const result = await api<Release>(action, payload);
    renderRelease(result);
    if (action === "publish") await load();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The release failed. Your saved content is retained.";
    renderRelease({ state: "failed", stage: message });
    failure(error);
  } finally {
    releaseAction = false;
    renderRelease(release!);
  }
}
function confirmRelease(action: "release" | "publish"): void {
  if (releaseAction) return;
  const local = workspace.mode === "local";
  modal(
    action === "publish"
      ? "Publish the reviewed release?"
      : local
        ? "Publish content to the live site?"
        : "Prepare this release?",
    action === "publish" || local ? "Publish release" : "Prepare release",
    async () => {
      dialog.close();
      await performRelease(action);
    },
  );
  $("dialog-body").append(
    el(
      "p",
      action === "publish"
        ? "This merges the checked editorial release. Vercel then builds and deploys it. Articles and issues marked as drafts remain unpublished."
        : local
          ? "Studio will check the workspace, run tests and a production build, then commit and push your content. Vercel deploys the release."
          : "Studio will validate the saved workspace and open a release for review. Preparing a release does not publish it. Drafts remain unpublished.",
    ),
  );
}
async function refresh(): Promise<void> {
  if (!workspace) {
    await load();
    return;
  }
  if (saving) await saving;
  if (
    dirty &&
    !confirm(
      "Refresh the workspace? Your unsaved edits will remain in browser recovery.",
    )
  )
    return;
  clearTimeout(autosave);
  const previous = current
    ? { collection: current.collection, id: current.id }
    : undefined;
  dirty = false;
  current = undefined;
  if (workspace.mode === "github") await api("sync", {});
  await load();
  if (previous) {
    const entry = workspace.entries.find(
      (e) => e.collection === previous.collection && e.id === previous.id,
    );
    if (entry) await openEntry(entry);
    else await showView(previous.collection);
  } else await showView(view);
  notice("Workspace refreshed.");
}
async function busy(
  button: HTMLElement,
  action: () => Promise<unknown>,
): Promise<void> {
  (button as HTMLButtonElement).disabled = true;
  try {
    await action();
  } catch (error) {
    failure(error);
  } finally {
    (button as HTMLButtonElement).disabled = false;
  }
}
function wire(): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-view]")
    .forEach((button) =>
      button.addEventListener(
        "click",
        () => void showView(button.dataset.view as View).catch(failure),
      ),
    );
  for (const id of ["search", "status-filter", "sort"])
    $(id).addEventListener(id === "search" ? "input" : "change", renderList);
  $("refresh").addEventListener(
    "click",
    () => void busy($("refresh"), refresh),
  );
  $("new-entry").addEventListener("click", createEntry);
  $("back").addEventListener(
    "click",
    () => void showView(current?.collection ?? "posts").catch(failure),
  );
  $("save").addEventListener("click", () => void save(true));
  $("entry-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void save(true);
  });
  sourceEditor = new SourceEditor(
    $("article-body"),
    (source) => {
      if (current) current.body = source;
      changed();
      wordCount();
    },
    notice,
  );
  $("format-source").addEventListener(
    "click",
    () => void busy($("format-source"), () => sourceEditor.format()),
  );
  $("undo-source").addEventListener("click", () => sourceEditor.undo());
  $("redo-source").addEventListener("click", () => sourceEditor.redo());
  $("search-source").addEventListener("click", () => sourceEditor.search());
  $("recover").addEventListener("click", () => {
    if (!restored || !current) return;
    current.data = clone(restored.entry.data);
    current.body = restored.entry.body;
    restored = undefined;
    manualRecovery = true;
    $("recovery").hidden = true;
    renderFields();
    sourceEditor.load(current.body);
    wordCount();
    changed();
    notice("Recovered edits. Review them, then save.");
  });
  $("discard-recovery").addEventListener("click", () => {
    restored = undefined;
    $("recovery").hidden = true;
    localStorage.removeItem(recoveryKey());
  });
  $("preview").addEventListener(
    "click",
    () => void busy($("preview"), preview),
  );
  $("history").addEventListener(
    "click",
    () => void busy($("history"), history),
  );
  $("delete-entry").addEventListener("click", () => {
    if (
      !current ||
      !confirm(
        `Delete “${title(current)}”? Remove references first. Deleted files can be recovered through Git or the local history directory.`,
      )
    )
      return;
    void busy($("delete-entry"), async () => {
      const collection = current!.collection;
      const result = await api<Library>("delete", {
        collection,
        id: current!.id,
        revision: workspace.revision,
      });
      clearTimeout(autosave);
      localStorage.removeItem(recoveryKey());
      dirty = false;
      current = undefined;
      accept(result);
      await showView(collection);
      notice("Entry deleted.");
    });
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-format]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        switch (button.dataset.format) {
          case "heading":
            insert("\n## ", "\n");
            break;
          case "bold":
            insert("**", "**");
            break;
          case "italic":
            insert("*", "*");
            break;
          case "link":
            insert("[", "](https://example.com)");
            break;
          case "code":
            insert("\n```csharp\n", "\n```\n");
            break;
          case "list":
            insert("\n- ", "\n");
            break;
        }
      }),
    );
  $("insert-component").addEventListener("click", insertBlock);
  $("insert-image").addEventListener("click", imagePicker);
  $("media-upload").addEventListener("change", (event) => {
    const upload = event.target as HTMLInputElement;
    void uploadFiles(upload.files)
      .catch(failure)
      .finally(() => {
        upload.value = "";
      });
  });
  dialog.addEventListener("close", () => {
    if (!dialog.open) {
      dialog.classList.remove("preview-dialog", "compare-dialog");
      $("dialog-body").replaceChildren();
      dialogSubmit = undefined;
    }
  });
  for (const id of ["close-dialog", "cancel-dialog"])
    $(id).addEventListener("click", () => dialog.close());
  $("dialog-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void busy($("dialog-submit"), async () => {
      await dialogSubmit?.();
    });
  });
  $("validate").addEventListener(
    "click",
    () =>
      void busy($("validate"), async () => {
        await api("validate", {});
        notice(
          "Workspace validation passed. All article syntax and content relationships are valid.",
        );
      }),
  );
  $("submit-release").addEventListener("click", () =>
    confirmRelease("release"),
  );
  $("refresh-release").addEventListener(
    "click",
    () => void busy($("refresh-release"), refreshRelease),
  );
  $("publish-release").addEventListener("click", () =>
    confirmRelease("publish"),
  );
  document.addEventListener("keydown", (event) => {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "s" &&
      current
    ) {
      event.preventDefault();
      void save(true);
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) {
      recoverable();
      event.preventDefault();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && dirty) recoverable();
  });
}
if ($("studio")) {
  input("new-entry").disabled = true;
  document
    .querySelectorAll<HTMLButtonElement>("[data-view]")
    .forEach((button) => {
      button.disabled = true;
    });
  wire();
  void load().catch((error) => {
    $("connection").textContent = "Connection failed";
    $("entry-list").replaceChildren(
      el(
        "p",
        "Could not load your workspace. Use Refresh to try again.",
        "empty-state",
      ),
    );
    failure(error);
  });
}
