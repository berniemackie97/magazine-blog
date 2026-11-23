import { describe, expect, it, vi, afterEach } from "vitest";
import { onRequest } from "../src/middleware";
import type { APIContext } from "astro";
afterEach(() => vi.unstubAllEnvs());
describe("editorial response boundaries", () => {
  it.each([
    "/studio",
    "/studio/preview",
    "/api/studio/library",
    "/api/studio/auth/login",
  ])("hides disabled hosted routes at %s", async (path) => {
    vi.stubEnv("CMS_ENABLED", "false");
    const next = vi.fn(async () => new Response("private"));
    const response = await onRequest(
      {
        url: new URL("https://example.test" + path),
        clientAddress: "203.0.113.1",
      } as APIContext,
      next,
    );
    expect(response!.status).toBe(404);
    expect(await response!.text()).toBe("Not found");
    expect(next).not.toHaveBeenCalled();
  });
  it("hides the editor shell from anonymous visitors on the enabled origin", async () => {
    vi.stubEnv("CMS_ENABLED", "true");
    vi.stubEnv("CMS_ORIGIN", "https://example.test");
    const next = vi.fn(async () => new Response("private"));
    const response = await onRequest(
      {
        url: new URL("https://example.test/studio"),
        clientAddress: "203.0.113.1",
        cookies: { get: () => undefined },
      } as unknown as APIContext,
      next,
    );
    expect(response!.status).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });
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
