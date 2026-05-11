import { describe, it, expect } from "vitest";
import { skipWeekend, isWeekend, createDateSet, isDateInSet, calculateTargetWorkday } from "@/lib/utils/dateUtils";

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

describe("calculateTargetWorkday", () => {
  it("Wednesday + 4 workdays = Monday (skips weekend)", () => {
    // Scenario A from plan: Wednesday (Rabu) + 4 workdays = Monday (Senin)
    // Day 1: Wed, Day 2: Thu, Day 3: Fri, Skip: Sat/Sun, Day 4: Mon
    const wednesday = new Date(2026, 1, 18); // Wednesday Feb 18, 2026
    const result = calculateTargetWorkday(wednesday, 4);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(23); // Feb 23, 2026
  });

  it("Wednesday + 5 workdays = Tuesday", () => {
    // Scenario B from plan: Wednesday + 5 workdays = Tuesday
    const wednesday = new Date(2026, 1, 18); // Wednesday Feb 18, 2026
    const result = calculateTargetWorkday(wednesday, 5);
    expect(result.getDay()).toBe(2); // Tuesday
    expect(result.getDate()).toBe(24); // Feb 24, 2026
  });

  it("Friday + 2 workdays = Monday (skips weekend)", () => {
    // Scenario C from plan: Friday (Jumat) + 2 workdays = Monday (Senin)
    // Day 1: Fri, Skip: Sat/Sun, Day 2: Mon
    const friday = new Date(2026, 1, 20); // Friday Feb 20, 2026
    const result = calculateTargetWorkday(friday, 2);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(23); // Feb 23, 2026
  });

  it("handles single workday correctly", () => {
    const monday = new Date(2026, 1, 16); // Monday Feb 16, 2026
    const result = calculateTargetWorkday(monday, 1);
    // With 1-indexed counting, day 1 is the start day itself
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(16); // Feb 16, 2026 (same day - start day counts as day 1)
  });

  it("handles crossing multiple weekends", () => {
    // Monday + 10 workdays should span two weeks
    const monday = new Date(2026, 1, 16); // Monday Feb 16, 2026
    const result = calculateTargetWorkday(monday, 10);
    // Mon(16) + 10 workdays = Fri(27) accounting for one weekend
    expect(result.getDay()).toBe(5); // Friday
    expect(result.getDate()).toBe(27); // Feb 27, 2026
  });
});
