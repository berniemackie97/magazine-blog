import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../src/middleware";
import type { APIContext } from "astro";
describe("editorial response boundaries", () => {
  it.each(["/_image", "/%5Fimage"])(
    "disables the unused image transformer at %s",
    async (path) => {
      const next = vi.fn(async () => new Response("should not render"));
      const response = await onRequest(
        {
          url: new URL("https://example.test" + path),
          routePattern: "/_image",
        } as APIContext,
        next,
      );
      if (!response) throw new Error("Middleware did not return a response.");
      expect(response.status).toBe(404);
      expect(next).not.toHaveBeenCalled();
    },
  );
  it.each(["/studio", "/studio/preview", "/api/studio/library"])(
    "prevents caching and indexing for %s",
    async (path) => {
      const response = await onRequest(
        {
          url: new URL("https://example.test" + path),
          routePattern: path,
        } as APIContext,
        async () => new Response("private"),
      );
      if (!response) throw new Error("Middleware did not return a response.");
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    },
  );
});
