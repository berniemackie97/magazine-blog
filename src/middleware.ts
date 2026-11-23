import type { MiddlewareHandler } from "astro";
import { identity, localAccess } from "./lib/studio/auth";
export const onRequest: MiddlewareHandler = async (context, next) => {
  if (context.routePattern === "/_image" || context.url.pathname === "/_image")
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const privateRoute =
    context.routePattern === "/studio" ||
    context.routePattern?.startsWith("/studio/") ||
    context.routePattern?.startsWith("/api/studio/") ||
    context.url.pathname === "/studio" ||
    context.url.pathname.startsWith("/studio/") ||
    context.url.pathname === "/api/studio" ||
    context.url.pathname.startsWith("/api/studio/");
  if (privateRoute) {
    let available =
      localAccess(context) ||
      (process.env.CMS_ENABLED === "true" &&
        context.url.origin === process.env.CMS_ORIGIN);
    if (available && !context.url.pathname.startsWith("/api/studio/")) {
      try {
        available = !!identity(context);
      } catch {
        available = false;
      }
    }
    if (!available)
      return new Response("Not found", {
        status: 404,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
  }
  const response = await next();
  if (privateRoute) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
  }
  return response;
};
