import type { MiddlewareHandler } from "astro";
export const onRequest: MiddlewareHandler = async (context, next) => {
  if (context.routePattern === "/_image" || context.url.pathname === "/_image")
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const response = await next();
  if (
    context.url.pathname === "/studio" ||
    context.url.pathname.startsWith("/studio/") ||
    context.url.pathname.startsWith("/api/studio/")
  ) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
  }
  return response;
};
