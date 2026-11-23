import { describe, expect, it, afterEach, vi } from "vitest";
import { seal, unseal, identity, verifyOrigin } from "../src/lib/studio/auth";
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
afterEach(() => vi.unstubAllEnvs());
describe("editor access", () => {
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
