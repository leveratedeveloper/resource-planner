import { describe, it, expect } from "vitest";
import { toLocalDateString } from "@/lib/utils";

describe("toLocalDateString", () => {
  it("formats a normal date correctly", () => {
    const date = new Date(2026, 1, 18); // Feb 18, 2026
    expect(toLocalDateString(date)).toBe("2026-02-18");
  });

  it("pads single-digit months", () => {
    const date = new Date(2026, 0, 5); // Jan 5
    expect(toLocalDateString(date)).toBe("2026-01-05");
  });

  it("pads single-digit days", () => {
    const date = new Date(2026, 11, 3); // Dec 3
    expect(toLocalDateString(date)).toBe("2026-12-03");
  });

  it("handles year boundary (Dec 31 → Jan 1)", () => {
    const dec31 = new Date(2025, 11, 31);
    expect(toLocalDateString(dec31)).toBe("2025-12-31");

    const jan1 = new Date(2026, 0, 1);
    expect(toLocalDateString(jan1)).toBe("2026-01-01");
  });

  it("handles leap year date", () => {
    const leapDay = new Date(2028, 1, 29); // Feb 29, 2028
    expect(toLocalDateString(leapDay)).toBe("2028-02-29");
  });
});
