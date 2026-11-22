import { describe, expect, it } from "vitest";
import { matchesFilters } from "../src/lib/filters";
import { isActivePath, urls } from "../src/lib/urls";

describe("isActivePath", () => {
  it("matches the section and its children", () => {
    expect(isActivePath("/issues", "/issues")).toBe(true);
    expect(isActivePath("/issues/red-ops/preflight", "/issues")).toBe(true);
    expect(isActivePath("/issues/", "/issues")).toBe(true);
  });

  it("does not match prefixes of other words", () => {
    expect(isActivePath("/issuesx", "/issues")).toBe(false);
  });

  it("treats home as exact", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/archive", "/")).toBe(false);
  });
});

describe("urls", () => {
  it("builds issue and post paths", () => {
    expect(urls.issue("red-ops", "preflight")).toBe("/issues/red-ops/preflight");
    expect(urls.post("signal-hunt")).toBe("/posts/signal-hunt");
  });
});

describe("matchesFilters", () => {
  const item = { publication: "red-ops", format: "feature", tags: ["tools", "red-team"] };

  it("matches everything when no filters are set", () => {
    expect(matchesFilters(item, { publication: "", format: "", tag: "" })).toBe(true);
  });

  it("requires every set filter to match", () => {
    expect(matchesFilters(item, { publication: "red-ops", format: "", tag: "tools" })).toBe(true);
    expect(matchesFilters(item, { publication: "red-ops", format: "brief", tag: "" })).toBe(false);
    expect(matchesFilters(item, { publication: "", format: "", tag: "radio" })).toBe(false);
  });
});
