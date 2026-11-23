import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import type { APIContext } from "astro";
import { GitHub, repository } from "./github";
import { StudioError } from "./content";

export interface Identity {
  login: string;
  token?: string;
  local: boolean;
}
const sessionCookie = "__Host-rack_studio";
const stateCookie = "__Host-rack_studio_oauth";
const lifetime = 8 * 60 * 60;
export function localAccess(
  context: Pick<APIContext, "url" | "clientAddress">,
): boolean {
  return (
    import.meta.env.DEV &&
    process.env.RACK_STUDIO_LOCAL === "1" &&
    context.url.hostname === "127.0.0.1" &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(context.clientAddress)
  );
}
export function configured(): boolean {
  return !!(
    process.env.CMS_GITHUB_CLIENT_ID &&
    process.env.CMS_GITHUB_CLIENT_SECRET &&
    process.env.CMS_SESSION_SECRET &&
    process.env.CMS_ORIGIN
  );
}
function secret(): Buffer {
  const value = process.env.CMS_SESSION_SECRET;
  if (!value || value.length < 32)
    throw new StudioError(
      503,
      "Set CMS_SESSION_SECRET to at least 32 random characters.",
    );
  return createHash("sha256").update(value).digest();
}
export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function unseal<T>(value: string): T | undefined {
  try {
    const bytes = Buffer.from(value, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      secret(),
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    ) as T;
  } catch {
    return undefined;
  }
}
export function origin(
  context: Pick<APIContext, "url" | "clientAddress">,
): string {
  if (localAccess(context)) return context.url.origin;
  if (process.env.CMS_ENABLED !== "true")
    throw new StudioError(404, "Not found");
  const configuredOrigin = process.env.CMS_ORIGIN;
  if (!configuredOrigin || !/^https:\/\/[^/]+$/.test(configuredOrigin))
    throw new StudioError(
      503,
      "Set CMS_ORIGIN to the HTTPS origin used for Studio.",
    );
  if (context.url.origin !== configuredOrigin)
    throw new StudioError(403, "Studio is not enabled on this origin.");
  return configuredOrigin;
}
export function verifyOrigin(context: APIContext): void {
  const expected = origin(context);
  const requestOrigin = context.request.headers.get("origin");
  if (context.request.method !== "GET" && requestOrigin !== expected)
    throw new StudioError(403, "This request did not come from Studio.");
  if (context.request.headers.get("sec-fetch-site") === "cross-site")
    throw new StudioError(403, "Cross-site requests are not allowed.");
}
export function identity(context: APIContext): Identity | undefined {
  if (localAccess(context)) return { login: "Local editor", local: true };
  origin(context);
  const value = context.cookies.get(sessionCookie)?.value;
  if (!value) return undefined;
  const session = unseal<{ login: string; token: string; expires: number }>(
    value,
  );
  const allowed = (process.env.CMS_ALLOWED_USERS || repository().split("/")[0]!)
    .split(",")
    .map((s) => s.trim().toLowerCase());
  if (
    !session ||
    session.expires < Date.now() ||
    !allowed.includes(session.login.toLowerCase())
  )
    return undefined;
  return { login: session.login, token: session.token, local: false };
}
export function requireIdentity(context: APIContext): Identity {
  verifyOrigin(context);
  const user = identity(context);
  if (!user) throw new StudioError(401, "Sign in to continue.");
  return user;
}
function cookieOptions(context: APIContext, maxAge: number) {
  return {
    httpOnly: true,
    secure: context.url.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
export function login(context: APIContext): Response {
  if (!configured())
    throw new StudioError(
      503,
      "Hosted Studio authentication is not configured.",
    );
  const callback = `${origin(context)}/api/studio/auth/callback`;
  const state = randomBytes(32).toString("hex");
  context.cookies.set(
    stateCookie,
    seal({ state, expires: Date.now() + 600_000 }),
    cookieOptions(context, 600),
  );
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: process.env.CMS_GITHUB_CLIENT_ID!,
    redirect_uri: callback,
    scope: "public_repo read:user",
    state,
  }).toString();
  return context.redirect(url.href, 302);
}
export async function callback(context: APIContext): Promise<Response> {
  const expectedOrigin = origin(context);
  const value = context.cookies.get(stateCookie)?.value;
  context.cookies.delete(stateCookie, { path: "/" });
  const record = value
    ? unseal<{ state: string; expires: number }>(value)
    : undefined;
  const state = context.url.searchParams.get("state") ?? "";
  const code = context.url.searchParams.get("code");
  if (
    !record ||
    record.expires < Date.now() ||
    state.length !== record.state.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(record.state)) ||
    !code
  )
    throw new StudioError(
      403,
      "The sign-in request expired or could not be verified. Start again.",
    );
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.CMS_GITHUB_CLIENT_ID,
      client_secret: process.env.CMS_GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${expectedOrigin}/api/studio/auth/callback`,
    }),
  });
  const data = (await response.json()) as { access_token?: string };
  if (!response.ok || !data.access_token)
    throw new StudioError(401, "GitHub sign-in failed. Try again.");
  const github = new GitHub(data.access_token);
  const user = await github.request<{ login: string }>("/user");
  const allowed = (process.env.CMS_ALLOWED_USERS || repository().split("/")[0]!)
    .split(",")
    .map((s) => s.trim().toLowerCase());
  if (!allowed.includes(user.login.toLowerCase()))
    throw new StudioError(
      403,
      "Your GitHub account is not allowed to edit this site.",
    );
  const repo = await github.repo<{ permissions?: { push?: boolean } }>("");
  if (!repo.permissions?.push)
    throw new StudioError(
      403,
      "Your GitHub account needs write access to this repository.",
    );
  const cookie = seal({
    login: user.login,
    token: data.access_token,
    expires: Date.now() + lifetime * 1000,
  });
  if (cookie.length > 3800)
    throw new StudioError(
      503,
      "The GitHub session exceeds the supported cookie size.",
    );
  context.cookies.set(sessionCookie, cookie, cookieOptions(context, lifetime));
  return context.redirect("/studio", 303);
}
export function logout(context: APIContext): Response {
  verifyOrigin(context);
  context.cookies.delete(sessionCookie, { path: "/" });
  return context.redirect("/studio", 303);
}
