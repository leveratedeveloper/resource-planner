import { describe, it, expect } from "vitest";
import { skipWeekend, isWeekend, createDateSet, isDateInSet } from "@/lib/utils/dateUtils";

describe("skipWeekend", () => {
  it("moves Saturday backward to Friday", () => {
    const sat = new Date(2026, 1, 21); // Saturday Feb 21
    const result = skipWeekend(sat, "backward");
    expect(result.getDay()).toBe(5); // Friday
  });

  it("moves Saturday forward to Monday", () => {
    const sat = new Date(2026, 1, 21); // Saturday Feb 21
    const result = skipWeekend(sat, "forward");
    expect(result.getDay()).toBe(1); // Monday
  });

  it("moves Sunday backward to Friday", () => {
    const sun = new Date(2026, 1, 22); // Sunday Feb 22
    const result = skipWeekend(sun, "backward");
    expect(result.getDay()).toBe(5); // Friday
  });

  it("moves Sunday forward to Monday", () => {
    const sun = new Date(2026, 1, 22); // Sunday Feb 22
    const result = skipWeekend(sun, "forward");
    expect(result.getDay()).toBe(1); // Monday
  });

  it("returns the same date for a weekday", () => {
    const wed = new Date(2026, 1, 18); // Wednesday Feb 18
    const result = skipWeekend(wed, "forward");
    expect(result.getTime()).toBe(wed.getTime());
  });
});

describe("isWeekend", () => {
  it("returns true for Saturday", () => {
    expect(isWeekend(new Date(2026, 1, 21))).toBe(true);
  });

  it("returns true for Sunday", () => {
    expect(isWeekend(new Date(2026, 1, 22))).toBe(true);
  });

  it("returns false for Monday", () => {
    expect(isWeekend(new Date(2026, 1, 16))).toBe(false);
  });

  it("returns false for Friday", () => {
    expect(isWeekend(new Date(2026, 1, 20))).toBe(false);
  });
});

describe("createDateSet", () => {
  it("creates a set from a single-day range", () => {
    const set = createDateSet([{ startDate: "2026-02-18", endDate: "2026-02-18" }]);
    expect(set.size).toBe(1);
  });

  it("creates a set from a multi-day range", () => {
    const set = createDateSet([{ startDate: "2026-02-16", endDate: "2026-02-18" }]);
    expect(set.size).toBe(3);
  });

  it("returns empty set for empty input", () => {
    const set = createDateSet([]);
    expect(set.size).toBe(0);
  });

  it("works with Date objects as inputs", () => {
    const set = createDateSet([
      { startDate: new Date(2026, 1, 18), endDate: new Date(2026, 1, 20) },
    ]);
    expect(set.size).toBe(3);
  });
});

describe("isDateInSet", () => {
  it("returns true when date is in the set", () => {
    const set = createDateSet([{ startDate: "2026-02-18", endDate: "2026-02-20" }]);
    const date = new Date(2026, 1, 19);
    expect(isDateInSet(date, set)).toBe(true);
  });

  it("returns false when date is not in the set", () => {
    const set = createDateSet([{ startDate: "2026-02-18", endDate: "2026-02-20" }]);
    const date = new Date(2026, 1, 21);
    expect(isDateInSet(date, set)).toBe(false);
  });
});
