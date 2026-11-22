import { describe, expect, it } from "vitest";
import { compareIsoDatesDesc, formatDate, parseIsoDate } from "../src/lib/dates";

describe("parseIsoDate", () => {
  it("parses as UTC midnight", () => {
    expect(parseIsoDate("2025-12-21").toISOString()).toBe("2025-12-21T00:00:00.000Z");
  });

  it.each(["12-21-2025", "2025-13-01", "2025-02-30", "2025-1-1", ""])("rejects %j", (value) => {
    expect(() => parseIsoDate(value)).toThrow();
  });
});

describe("compareIsoDatesDesc", () => {
  it("sorts newest first", () => {
    const dates = ["2024-07-12", "2025-12-21", "2024-08-10"];
    expect([...dates].sort(compareIsoDatesDesc)).toEqual(["2025-12-21", "2024-08-10", "2024-07-12"]);
  });
});

describe("formatDate", () => {
  it("does not shift the day across time zones", () => {
    expect(formatDate("2025-12-21", "short")).toBe("Dec 21, 2025");
    expect(formatDate("2025-12-21", "compact")).toBe("Dec 21");
  });
});
