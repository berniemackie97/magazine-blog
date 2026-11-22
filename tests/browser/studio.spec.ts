import { expect, test } from "@playwright/test";
const id = "studio-browser-acceptance";
test("writes, previews, edits, compares history, and deletes a draft", async ({
  page,
  request,
}) => {
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
    await page
      .locator("#article-body")
      .fill(
        '## An actual draft\n\nA **formatted** paragraph.\n\n<Callout title="Verified">A saved note.</Callout>\n',
      );
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
