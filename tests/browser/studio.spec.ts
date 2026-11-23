import { expect, test } from "@playwright/test";
const id = "studio-browser-acceptance";
test("writes, previews, edits, compares history, and deletes a draft", async ({
  page,
  request,
}) => {
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  const initial = await (await request.get("/api/studio/library")).json();
  expect(initial.entries.some((entry: { id: string }) => entry.id === id)).toBe(
    false,
  );
  try {
    await page.goto("/studio");
    await expect(page.locator("#connection")).toContainText("Local workspace");
    await expect(page.locator(".entry-card")).toHaveCount(
      initial.entries.filter(
        (entry: { collection: string }) => entry.collection === "posts",
      ).length,
    );
    await page.locator("#new-entry").click();
    await page.getByLabel(/URL slug/).fill(id);
    await page
      .getByRole("button", { name: "Create draft", exact: true })
      .click();
    await page.locator('[name="headline"]').fill("Browser acceptance story");
    await page.locator('[name="issue"]').selectOption("trail-circuits");
    await page
      .locator("#article-body .cm-content")
      .fill(
        '## An actual draft\n\nA **formatted** paragraph.\n\n<Callout title="Verified">A saved note.</Callout>\n',
      );
    await expect(page.locator("#editor-diagnostic")).toHaveText("MDX checked");
    await expect(
      page.locator("#article-body .cm-line span").first(),
    ).toBeVisible();
    await page.locator("#format-source").click();
    await expect(page.locator("#notice")).toContainText("Document formatted");
    await expect(page.locator("#editor-diagnostic")).toHaveText("MDX checked");
    await page.locator("#save").click();
    await expect(page.locator("#save-status")).toHaveText("All changes saved");
    await page.locator("#preview").click();
    const preview = page.frameLocator('iframe[title="Content preview"]');
    await expect(
      preview.getByRole("heading", {
        name: "Browser acceptance story",
        exact: true,
      }),
    ).toBeVisible();
    await expect(preview.getByText("A saved note.")).toBeVisible();
    const backToIssue = preview.getByRole("link", {
      name: /back to Trail Circuits contents/,
    });
    await expect(backToIssue).toHaveAttribute("href", /studio\/preview/);
    await backToIssue.click();
    await expect(
      preview.getByRole("heading", { name: /Contents/ }),
    ).toBeVisible();
    const articleLink = preview.getByRole("link", {
      name: /Browser acceptance story/,
    });
    await expect(articleLink).toHaveAttribute("href", /studio\/preview/);
    await articleLink.click();
    await expect(
      preview.getByRole("heading", {
        name: "Browser acceptance story",
        exact: true,
      }),
    ).toBeVisible();
    await page.locator("#close-dialog").click();
    await page
      .locator('[name="headline"]')
      .fill("Revised browser acceptance story");
    await page.locator("#save").click();
    await expect(page.locator("#save-status")).toHaveText("All changes saved");
    await page.locator("#history").click();
    await expect(
      page.getByRole("button", { name: "Compare", exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Compare", exact: true })
      .first()
      .click();
    await expect(page.locator(".revision-compare")).toContainText(
      "Browser acceptance story",
    );
    await page.locator("#close-dialog").click();
    await page.locator("#back").click();
    await page.locator("#search").fill("Revised browser acceptance story");
    await expect(page.locator(".entry-card")).toHaveCount(1);
    await page.screenshot({
      path: "test-results/studio-desktop.png",
      fullPage: true,
    });
    expect(navigations).toBe(1);
    await page.locator(".entry-card").click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#delete-entry").click();
    await expect(page.locator("#notice")).toHaveText("Entry deleted.");
  } finally {
    const latest = await (await request.get("/api/studio/library")).json();
    if (latest.entries.some((entry: { id: string }) => entry.id === id)) {
      const removed = await request.post("/api/studio/delete", {
        data: { collection: "posts", id, revision: latest.revision },
        headers: { Origin: "http://127.0.0.1:4322" },
      });
      expect(removed.ok()).toBe(true);
    }
  }
});
test("keeps the library and release controls usable on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  await expect(page.locator("#connection")).toContainText("Local workspace");
  await expect(page.locator("#new-entry")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator('[data-view="release"]').click();
  await expect(page.locator("#validate")).toBeVisible();
  await page.locator("#validate").click();
  await expect(page.locator("#notice")).toContainText(
    "Workspace validation passed",
  );
  await page.screenshot({
    path: "test-results/studio-mobile.png",
    fullPage: true,
  });
});
test("recovers interrupted edits without autosaving over a newer version", async ({
  page,
  request,
}) => {
  const recoveryId = "studio-recovery-acceptance";
  const headers = { Origin: "http://127.0.0.1:4322" };
  const initial = await (await request.get("/api/studio/library")).json();
  expect(
    initial.entries.some((entry: { id: string }) => entry.id === recoveryId),
  ).toBe(false);
  const source = initial.entries.find(
    (entry: { collection: string }) => entry.collection === "posts",
  );
  let created = false;
  page.on("dialog", (dialog) => dialog.accept());
  try {
    const response = await request.post("/api/studio/create", {
      headers,
      data: {
        ...source,
        id: recoveryId,
        data: {
          ...source.data,
          headline: "Recovery acceptance draft",
          draft: true,
        },
        revision: initial.revision,
      },
    });
    expect(response.ok()).toBe(true);
    created = true;
    await page.goto("/studio");
    await page
      .getByRole("button", { name: /Recovery acceptance draft/ })
      .click();
    await page.route("**/api/studio/save", (route) => route.abort("failed"));
    await page.locator('[name="headline"]').fill("Recovered writing");
    await page.locator("#save").click();
    await expect(page.locator("#save-status")).toContainText("Not saved");
    await page.unroute("**/api/studio/save");
    const latest = await (await request.get("/api/studio/library")).json();
    const entry = latest.entries.find(
      (entry: { id: string }) => entry.id === recoveryId,
    );
    const newer = await request.post("/api/studio/save", {
      headers,
      data: {
        ...entry,
        data: { ...entry.data, headline: "Newer saved writing" },
        revision: latest.revision,
      },
    });
    expect(newer.ok()).toBe(true);
    await page.goto("/studio");
    await page.getByRole("button", { name: /Newer saved writing/ }).click();
    await expect(page.locator("#recovery")).toBeVisible();
    await page.locator("#recover").click();
    await expect(page.locator('[name="headline"]')).toHaveValue(
      "Recovered writing",
    );
    // Wait beyond the autosave debounce to verify recovery requires an explicit save.
    await page.waitForTimeout(2200);
    const untouched = await (await request.get("/api/studio/library")).json();
    expect(
      untouched.entries.find((entry: { id: string }) => entry.id === recoveryId)
        .data.headline,
    ).toBe("Newer saved writing");
    await page.locator("#save").click();
    await expect(page.locator("#save-status")).toHaveText("All changes saved");
    await page.locator("#article-body .cm-content").fill("A broken <Callout");
    await expect(page.locator("#editor-diagnostic")).not.toHaveText(
      "MDX checked",
    );
    await page.locator("#save").click();
    await expect(page.locator("#save-status")).toContainText("Not saved");
    await page.locator("#history").click();
    await expect(
      page
        .getByRole("button", { name: "Restore as draft", exact: true })
        .first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Restore as draft", exact: true })
      .first()
      .click();
    await expect(page.locator("#notice")).toContainText(
      "Revision restored as a draft",
    );
  } finally {
    if (created) {
      const latest = await (await request.get("/api/studio/library")).json();
      const removed = await request.post("/api/studio/delete", {
        headers,
        data: {
          collection: "posts",
          id: recoveryId,
          revision: latest.revision,
        },
      });
      expect(removed.ok()).toBe(true);
    }
  }
});

test("completes magazine components, indents, searches, formats, and undoes", async ({
  page,
  request,
}) => {
  const headers = { Origin: "http://127.0.0.1:4322" };
  const editorId = "studio-editor-acceptance";
  const initial = await (await request.get("/api/studio/library")).json();
  const source = initial.entries.find(
    (entry: { collection: string }) => entry.collection === "posts",
  );
  const created = await request.post("/api/studio/create", {
    headers,
    data: {
      ...source,
      id: editorId,
      revision: initial.revision,
      data: { ...source.data, headline: "Editor acceptance", draft: true },
      body: "",
    },
  });
  expect(created.ok()).toBe(true);
  try {
    await page.goto("/studio");
    await page.getByRole("button", { name: /Editor acceptance/ }).click();
    const body = page.locator("#article-body .cm-content");
    await body.fill("<Call");
    await body.press("Control+Space");
    await expect(page.getByRole("option", { name: /Callout/ })).toBeVisible();
    await body.press("Enter");
    await expect(body).toHaveText("<Callout");
    await body.press("Space");
    await body.press("Control+Space");
    await expect(page.getByRole("option", { name: /title/ })).toBeVisible();
    await body.press("Escape");
    await body.fill('<Callout title="A note">A paragraph.</Callout>');
    await page.locator("#format-source").click();
    await expect(page.locator("#notice")).toContainText("Document formatted");
    await expect(page.locator("#editor-diagnostic")).toHaveText("MDX checked");
    await body.fill("A paragraph.");
    await body.press("Home");
    await body.press("Tab");
    await expect(body).toHaveText("  A paragraph.");
    await page.locator("#undo-source").click();
    await expect(body).toHaveText("A paragraph.");
    await page.locator("#redo-source").click();
    await expect(body).toHaveText("  A paragraph.");
    await page.locator("#search-source").click();
    await expect(page.locator(".cm-search input[name=search]")).toBeVisible();
    await body.fill(
      '<ResourceCard title="Valid title" href="https://example.com" tone="invalid" />',
    );
    await expect(page.locator("#editor-diagnostic")).toContainText(
      "ResourceCard",
    );
    await expect(page.locator(".cm-lintRange-error")).toBeVisible();
    await page.screenshot({
      path: "test-results/studio-source-editor.png",
      fullPage: true,
    });
    await body.fill("A valid draft.");
    await page.locator("#save").click();
    await expect(page.locator("#save-status")).toHaveText("All changes saved");
  } finally {
    const latest = await (await request.get("/api/studio/library")).json();
    await request.post("/api/studio/delete", {
      headers,
      data: { collection: "posts", id: editorId, revision: latest.revision },
    });
  }
});
