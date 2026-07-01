import { describe, it, expect } from "vitest";
import {
  clampRange,
  monthsInRange,
  getMonthCellState,
} from "./custom-range";

describe("clampRange", () => {
  it("keeps a valid in-range span unchanged (snapped to first of month)", () => {
    expect(clampRange(new Date(2026, 6, 10), new Date(2026, 11, 20))).toEqual({
      start: new Date(2026, 6, 1),
      end: new Date(2026, 11, 1),
    });
  });

  it("pulls end up to start when end is before start", () => {
    expect(clampRange(new Date(2026, 6, 1), new Date(2026, 3, 1))).toEqual({
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 1),
    });
  });

  it("caps a too-long span at the max window", () => {
    // Jul 2026 -> Dec 2027 is 18 months; cap to 12 -> Jun 2027.
    expect(clampRange(new Date(2026, 6, 1), new Date(2027, 11, 1))).toEqual({
      start: new Date(2026, 6, 1),
      end: new Date(2027, 5, 1),
    });
  });
});

describe("monthsInRange", () => {
  it("counts inclusive months, cross-year aware", () => {
    expect(monthsInRange(new Date(2026, 6, 1), new Date(2026, 11, 1))).toBe(6);
    expect(monthsInRange(new Date(2026, 10, 1), new Date(2027, 1, 1))).toBe(4);
    expect(monthsInRange(new Date(2026, 6, 1), new Date(2026, 6, 1))).toBe(1);
  });
});

describe("getMonthCellState", () => {
  it("classifies a committed range (no cap anchor)", () => {
    const range = { rangeStart: new Date(2026, 6, 1), rangeEnd: new Date(2026, 11, 1), capAnchor: null };
    expect(getMonthCellState({ month: new Date(2026, 6, 1), ...range })).toBe("start");
    expect(getMonthCellState({ month: new Date(2026, 11, 1), ...range })).toBe("end");
    expect(getMonthCellState({ month: new Date(2026, 8, 1), ...range })).toBe("in-range");
    expect(getMonthCellState({ month: new Date(2026, 0, 1), ...range })).toBe("default");
  });

  it("treats a single-month range as start", () => {
    expect(
      getMonthCellState({
        month: new Date(2026, 6, 1),
        rangeStart: new Date(2026, 6, 1),
        rangeEnd: new Date(2026, 6, 1),
        capAnchor: null,
      }),
    ).toBe("start");
  });

  it("disables months beyond the cap while picking an end", () => {
    // cap end = Jul 2026 + 11 = Jun 2027
    const picking = { rangeStart: new Date(2026, 6, 1), rangeEnd: new Date(2026, 6, 1), capAnchor: new Date(2026, 6, 1) };
    expect(getMonthCellState({ month: new Date(2026, 6, 1), ...picking })).toBe("start");
    expect(getMonthCellState({ month: new Date(2027, 5, 1), ...picking })).toBe("default");
    expect(getMonthCellState({ month: new Date(2027, 6, 1), ...picking })).toBe("disabled");
  });

  it("previews the hovered span while picking, cross-year", () => {
    const preview = { rangeStart: new Date(2026, 10, 1), rangeEnd: new Date(2027, 1, 1), capAnchor: new Date(2026, 10, 1) };
    expect(getMonthCellState({ month: new Date(2026, 10, 1), ...preview })).toBe("start");
    expect(getMonthCellState({ month: new Date(2026, 11, 1), ...preview })).toBe("in-range");
    expect(getMonthCellState({ month: new Date(2027, 0, 1), ...preview })).toBe("in-range");
    expect(getMonthCellState({ month: new Date(2027, 1, 1), ...preview })).toBe("end");
  });
});
