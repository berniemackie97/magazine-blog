import { describe, expect, it, afterEach, vi } from "vitest";
import {
  seal,
  unseal,
  identity,
  verifyOrigin,
  localAccess,
  callback,
  login,
  configured,
} from "../src/lib/studio/auth";
import type { APIContext } from "astro";
const valid = () => ({
  login: "berniemackie97",
  token: "test-token",
  expires: Date.now() + 10000,
});
function context(
  cookie: string,
  origin = "https://the-rack.vercel.app",
  requestOrigin = origin,
  method = "POST",
): APIContext {
  return {
    url: new URL(origin + "/api/studio/library"),
    request: new Request(origin + "/api/studio/library", {
      method,
      headers: { origin: requestOrigin },
    }),
    cookies: { get: () => ({ value: cookie }) },
    clientAddress: "203.0.113.1",
  } as unknown as APIContext;
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("editor access", () => {
  it("requires an explicit local launch and loopback hostname and client", () => {
    const local = {
      url: new URL("http://127.0.0.1:4321/studio"),
      clientAddress: "127.0.0.1",
    };
    vi.stubEnv("RACK_STUDIO_LOCAL", "0");
    expect(localAccess(local)).toBe(false);
    vi.stubEnv("RACK_STUDIO_LOCAL", "1");
    expect(localAccess(local)).toBe(true);
    expect(localAccess({ ...local, clientAddress: "203.0.113.1" })).toBe(false);
    expect(
      localAccess({ ...local, url: new URL("http://example.test/studio") }),
    ).toBe(false);
  });
  it("disables hosted access unless explicitly enabled, even with a valid session", () => {
    vi.stubEnv(
      "CMS_SESSION_SECRET",
      "a-test-secret-at-least-32-characters-long",
    );
    vi.stubEnv("CMS_ORIGIN", "https://the-rack.vercel.app");
    vi.stubEnv("CMS_ENABLED", "false");
    expect(() => identity(context(seal(valid())))).toThrow("Not found");
  });
  it("encrypts sessions and rejects tampering", () => {
    vi.stubEnv(
      "CMS_SESSION_SECRET",
      "a-test-secret-at-least-32-characters-long",
    );
    const value = valid();
    const cookie = seal(value);
    expect(cookie).not.toContain(value.token);
    expect(unseal(cookie)).toEqual(value);
    const data = Buffer.from(cookie, "base64url");
    data[30] = data[30]! ^ 1;
    expect(unseal(data.toString("base64url"))).toBeUndefined();
  });
  it("rejects expired sessions and removed users", () => {
    vi.stubEnv(
      "CMS_SESSION_SECRET",
      "a-test-secret-at-least-32-characters-long",
    );
    vi.stubEnv("CMS_ENABLED", "true");
    vi.stubEnv("CMS_ORIGIN", "https://the-rack.vercel.app");
    expect(identity(context(seal({ ...valid(), expires: 0 })))).toBeUndefined();
    expect(
      identity(context(seal({ ...valid(), login: "someone-else" }))),
    ).toBeUndefined();
    expect(identity(context(seal(valid())))?.login).toBe("berniemackie97");
  });
  it("rejects cross-origin writes and unconfigured hosting origins", () => {
    vi.stubEnv("CMS_ENABLED", "true");
    vi.stubEnv("CMS_ORIGIN", "https://the-rack.vercel.app");
    expect(() =>
      verifyOrigin(context("", undefined, "https://evil.test")),
    ).toThrow("did not come from Studio");
    expect(() => verifyOrigin(context("", "https://preview.example"))).toThrow(
      "not enabled",
    );
    expect(() => verifyOrigin(context(""))).not.toThrow();
  });
});

describe("GitHub sign-in callback", () => {
  function callbackContext(state = "a".repeat(64)) {
    vi.stubEnv("CMS_ENABLED", "true");
    vi.stubEnv("CMS_ORIGIN", "https://the-rack.vercel.app");
    vi.stubEnv(
      "CMS_SESSION_SECRET",
      "a-test-secret-at-least-32-characters-long",
    );
    vi.stubEnv("CMS_GITHUB_CLIENT_ID", "  fixture-client \n");
    vi.stubEnv("CMS_GITHUB_CLIENT_SECRET", " fixture-secret \n");
    const ctx = context(
      seal({ state: "a".repeat(64), expires: Date.now() + 60_000 }),
      undefined,
      undefined,
      "GET",
    );
    ctx.url.searchParams.set("state", state);
    ctx.url.searchParams.set("code", "fixture-code");
    ctx.redirect = (location, status = 302) =>
      new Response(null, { status, headers: { Location: location } });
    const set = vi.fn();
    const remove = vi.fn();
    Object.assign(ctx.cookies, { set, delete: remove });
    return { ctx, set, remove };
  }
  it("normalizes pasted OAuth settings before redirecting and rejects empty values", () => {
    const { ctx } = callbackContext();
    const response = login(ctx);
    expect(
      new URL(response.headers.get("Location")!).searchParams.get("client_id"),
    ).toBe("fixture-client");
    vi.stubEnv("CMS_GITHUB_CLIENT_SECRET", " \n ");
    expect(configured()).toBe(false);
  });
  it("rejects malformed state before exchanging a code", async () => {
    const { ctx, remove } = callbackContext("é".repeat(64));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(callback(ctx)).rejects.toMatchObject({ status: 403 });
    expect(fetch).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("__Host-rack_studio_oauth", {
      path: "/",
    });
  });
  it.each([
    { login: "berniemackie97", push: true, accepted: true },
    { login: "someone-else", push: true, accepted: false },
    { login: "berniemackie97", push: false, accepted: false },
  ])(
    "requires an allowed account and repository write access: $login / $push",
    async ({ login, push, accepted }) => {
      const { ctx, set, remove } = callbackContext();
      const fetch = vi
        .fn()
        .mockImplementation(async (input: string, init: RequestInit = {}) => {
          if (input === "https://github.com/login/oauth/access_token") {
            expect(JSON.parse(init.body as string)).toMatchObject({
              client_id: "fixture-client",
              client_secret: "fixture-secret",
            });
            return Response.json({ access_token: "fixture-access-token" });
          }
          if (input === "https://api.github.com/user")
            return Response.json({ login });
          if (
            input ===
            "https://api.github.com/repos/berniemackie97/magazine-blog"
          )
            return Response.json({ permissions: { push } });
          throw new Error("Unexpected authentication request");
        });
      vi.stubGlobal("fetch", fetch);
      if (accepted) {
        const result = await callback(ctx);
        expect(result.status).toBe(303);
        expect(result.headers.get("Location")).toBe("/studio");
        expect(set.mock.calls[0]![0]).toBe("__Host-rack_studio");
        expect(set.mock.calls[0]![2]).toMatchObject({
          secure: true,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
        expect(unseal(set.mock.calls[0]![1])).toMatchObject({
          login,
          token: "fixture-access-token",
        });
      } else {
        await expect(callback(ctx)).rejects.toMatchObject({ status: 403 });
        expect(set).not.toHaveBeenCalled();
      }
      expect(remove).toHaveBeenCalledWith("__Host-rack_studio_oauth", {
        path: "/",
      });
    },
  );
});
