export type VideoSource =
  | { kind: "embed"; src: string }
  | { kind: "file"; src: string }
  | { kind: "none" };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const VIMEO_ID = /^\d{4,15}$/;

/**
 * Turns an author-supplied video URL into something safe to render. Only
 * YouTube, Vimeo and same-site files are accepted; anything else renders nothing.
 */
export function resolveVideo(raw: string | undefined): VideoSource {
  if (!raw) return { kind: "none" };

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return { kind: "file", src: raw };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: "none" };
  }
  if (url.protocol !== "https:") return { kind: "none" };

  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return youtube(url.pathname.slice(1));
  if (host === "youtube.com") {
    const id = url.searchParams.get("v") ?? url.pathname.split("/embed/")[1];
    return youtube(id);
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).pop();
    return id && VIMEO_ID.test(id)
      ? { kind: "embed", src: `https://player.vimeo.com/video/${id}?dnt=1` }
      : { kind: "none" };
  }
  return { kind: "none" };
}

function youtube(id: string | null | undefined): VideoSource {
  return id && YOUTUBE_ID.test(id)
    ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}` }
    : { kind: "none" };
}
