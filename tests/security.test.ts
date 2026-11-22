import { describe, expect, it } from "vitest";
import { toStyle } from "../src/lib/theme";
import { resolveVideo } from "../src/lib/video";

describe("resolveVideo", () => {
  it("maps YouTube links to the privacy-enhanced embed", () => {
    expect(resolveVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "embed",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
    expect(resolveVideo("https://youtu.be/dQw4w9WgXcQ").kind).toBe("embed");
  });

  it("maps Vimeo links with do-not-track", () => {
    expect(resolveVideo("https://vimeo.com/123456789")).toEqual({
      kind: "embed",
      src: "https://player.vimeo.com/video/123456789?dnt=1",
    });
  });

  it("allows same-site files only", () => {
    expect(resolveVideo("/videos/tour.mp4")).toEqual({ kind: "file", src: "/videos/tour.mp4" });
    expect(resolveVideo("//evil.example/x.mp4").kind).toBe("none");
  });

  it.each([
    "javascript:alert(1)",
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=<script>",
    "not a url",
  ])("rejects %j", (value) => {
    expect(resolveVideo(value).kind).toBe("none");
  });
});

describe("toStyle", () => {
  it("serialises custom properties", () => {
    expect(toStyle({ "--a": "#000000", "--b": "#ffffff" })).toBe("--a:#000000;--b:#ffffff");
  });
});
