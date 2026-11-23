import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { handle } from "../../../lib/studio/service";
import { callback, login, logout } from "../../../lib/studio/auth";
import { StudioError } from "../../../lib/studio/content";
export const prerender = false;
export const ALL: APIRoute = async (context) => {
  try {
    if (
      context.params.path === "auth/login" &&
      context.request.method === "GET"
    )
      return login(context);
    if (
      context.params.path === "auth/callback" &&
      context.request.method === "GET"
    )
      return await callback(context);
    if (
      context.params.path === "auth/logout" &&
      context.request.method === "POST"
    )
      return logout(context);
    return await handle(context);
  } catch (error) {
    const status =
      error instanceof StudioError
        ? error.status
        : error instanceof z.ZodError
          ? 422
          : 500;
    const message =
      error instanceof z.ZodError
        ? error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("\n")
        : error instanceof StudioError
          ? error.message
          : "Studio could not complete this request. Your edits have been preserved.";
    if (status === 500)
      console.error(
        "Studio request failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
    return Response.json(
      { error: message },
      {
        status,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }
};
