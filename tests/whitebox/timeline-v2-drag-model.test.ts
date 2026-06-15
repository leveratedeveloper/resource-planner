import { describe, expect, it } from "vitest";
import {
  getColumnIndexFromPointer,
  getDragRange,
  getResizePreview,
  moveDatesPreservingSpan,
  rangeToDates,
} from "@/lib/timeline-v2/drag-model";
import type { TimelineColumn } from "@/lib/timeline-v2/types";
import { toLocalDateString } from "@/lib/utils";

function dayColumn(year: number, month: number, day: number): TimelineColumn {
  const date = new Date(year, month - 1, day);
  return {
    id: toLocalDateString(date),
    date,
    label: "",
    subLabel: null,
    kind: "day",
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
    isToday: false,
    isCurrentMonth: false,
  };
}

// June 2026: Jun 1 is a Monday. Two work weeks with weekends HIDDEN —
// the columns array itself contains no Sat/Sun, exactly like
// getTimelineColumns with showWeekends=false.
const weekendsHiddenColumns: TimelineColumn[] = [
  dayColumn(2026, 6, 1), // 0: Mon
  dayColumn(2026, 6, 2), // 1: Tue
  dayColumn(2026, 6, 3), // 2: Wed
  dayColumn(2026, 6, 4), // 3: Thu
  dayColumn(2026, 6, 5), // 4: Fri
  dayColumn(2026, 6, 8), // 5: Mon (Sat 6 / Sun 7 hidden)
  dayColumn(2026, 6, 9), // 6: Tue
  dayColumn(2026, 6, 10), // 7: Wed
  dayColumn(2026, 6, 11), // 8: Thu
  dayColumn(2026, 6, 12), // 9: Fri
];

// Same week with weekends VISIBLE.
const weekendsVisibleColumns: TimelineColumn[] = [
  dayColumn(2026, 6, 4), // 0: Thu
  dayColumn(2026, 6, 5), // 1: Fri
  dayColumn(2026, 6, 6), // 2: Sat
  dayColumn(2026, 6, 7), // 3: Sun
  dayColumn(2026, 6, 8), // 4: Mon
  dayColumn(2026, 6, 9), // 5: Tue
];

function toKeys(result: { startDate: Date; endDate: Date } | null) {
  if (!result) return null;
  return {
    startDate: toLocalDateString(result.startDate),
    endDate: toLocalDateString(result.endDate),
  };
}

describe("getColumnIndexFromPointer", () => {
  // canvas spans x=[100, 600], 10 columns of 50px each
  const canvas = { canvasLeft: 100, canvasWidth: 500, columnCount: 10 };

  it("maps a pointer inside a column to that column's index", () => {
    expect(getColumnIndexFromPointer({ ...canvas, clientX: 125 })).toBe(0);
    expect(getColumnIndexFromPointer({ ...canvas, clientX: 175 })).toBe(1);
    expect(getColumnIndexFromPointer({ ...canvas, clientX: 599 })).toBe(9);
  });

  it("assigns an exact column boundary to the column on its right", () => {
    // x=150 is the shared edge of columns 0 and 1; floor math puts it in 1
    expect(getColumnIndexFromPointer({ ...canvas, clientX: 150 })).toBe(1);
    expect(getColumnIndexFromPointer({ ...canvas, clientX: 149.9 })).toBe(0);
    expect(getColumnIndexFromPointer({ ...canvas, clientX: 100 })).toBe(0);
  });

  it("clamps a pointer left of the canvas to the first column", () => {
    expect(getColumnIndexFromPointer({ ...canvas, clientX: 99 })).toBe(0);
    expect(getColumnIndexFromPointer({ ...canvas, clientX: -5000 })).toBe(0);
  });

  it("clamps a pointer at or past the right canvas edge to the last column", () => {
    // x=600 is the canvas right edge: raw index 10 must clamp to 9
    expect(getColumnIndexFromPointer({ ...canvas, clientX: 600 })).toBe(9);
    expect(getColumnIndexFromPointer({ ...canvas, clientX: 5000 })).toBe(9);
  });
});

describe("getDragRange", () => {
  it("keeps order when dragging forward", () => {
    expect(getDragRange(2, 6)).toEqual({ startIndex: 2, endIndex: 6 });
  });

  it("normalizes a backward drag so startIndex <= endIndex", () => {
    expect(getDragRange(6, 2)).toEqual({ startIndex: 2, endIndex: 6 });
  });

  it("yields a single-column range when anchor equals current (single click)", () => {
    // mirrors DraggableTimelineCell: a click without movement creates a 1-day assignment
    expect(getDragRange(3, 3)).toEqual({ startIndex: 3, endIndex: 3 });
  });
});

describe("getResizePreview", () => {
  const base = { startIndex: 3, endIndex: 5, columnCount: 10 };

  it("moves the start edge by delta", () => {
    expect(getResizePreview({ ...base, edge: "start", deltaColumns: -2 })).toEqual({
      startIndex: 1,
      endIndex: 5,
    });
  });

  it("clamps the start edge at the end index when dragged past it", () => {
    expect(getResizePreview({ ...base, edge: "start", deltaColumns: 7 })).toEqual({
      startIndex: 5,
      endIndex: 5,
    });
  });

  it("clamps the start edge at column 0", () => {
    expect(getResizePreview({ ...base, edge: "start", deltaColumns: -10 })).toEqual({
      startIndex: 0,
      endIndex: 5,
    });
  });

  it("moves the end edge by delta", () => {
    expect(getResizePreview({ ...base, edge: "end", deltaColumns: 3 })).toEqual({
      startIndex: 3,
      endIndex: 8,
    });
  });

  it("clamps the end edge at the start index when dragged before it", () => {
    expect(getResizePreview({ ...base, edge: "end", deltaColumns: -7 })).toEqual({
      startIndex: 3,
      endIndex: 3,
    });
  });

  it("clamps the end edge at the last column", () => {
    expect(getResizePreview({ ...base, edge: "end", deltaColumns: 10 })).toEqual({
      startIndex: 3,
      endIndex: 9,
    });
  });

  it("shifts both edges on move", () => {
    expect(getResizePreview({ ...base, edge: "move", deltaColumns: 2 })).toEqual({
      startIndex: 5,
      endIndex: 7,
    });
  });

  it("preserves the span when a move hits the right wall", () => {
    expect(getResizePreview({ ...base, edge: "move", deltaColumns: 10 })).toEqual({
      startIndex: 7,
      endIndex: 9,
    });
  });

  it("preserves the span when a move hits the left wall", () => {
    expect(getResizePreview({ ...base, edge: "move", deltaColumns: -10 })).toEqual({
      startIndex: 0,
      endIndex: 2,
    });
  });
});

describe("rangeToDates", () => {
  it("reads calendar dates straight from the visible columns", () => {
    const { startDate, endDate } = rangeToDates(
      { startIndex: 1, endIndex: 3 },
      weekendsHiddenColumns
    );
    expect(toLocalDateString(startDate)).toBe("2026-06-02");
    expect(toLocalDateString(endDate)).toBe("2026-06-04");
  });

  it("maps a Fri..Mon visible span to real Fri..Mon calendar dates when weekends are hidden", () => {
    // columns 4 and 5 are visually adjacent, but the calendar gap (Sat/Sun) is real:
    // the stored assignment must span Fri Jun 5 .. Mon Jun 8 (4 calendar days)
    const { startDate, endDate } = rangeToDates(
      { startIndex: 4, endIndex: 5 },
      weekendsHiddenColumns
    );
    expect(toLocalDateString(startDate)).toBe("2026-06-05");
    expect(toLocalDateString(endDate)).toBe("2026-06-08");
  });
});

describe("moveDatesPreservingSpan", () => {
  it("shifts both dates along visible columns within the same week", () => {
    const result = moveDatesPreservingSpan({
      deltaColumns: 1,
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      columns: weekendsHiddenColumns,
    });
    expect(toKeys(result)).toEqual({ startDate: "2026-06-02", endDate: "2026-06-04" });
  });

  it("skips hidden weekend days when shifting right (Thu-Fri +1 lands Fri-Mon)", () => {
    // Legacy AssignmentBlock move: indices shift along the visible days array,
    // so the end date jumps Fri -> Mon across the hidden weekend.
    const result = moveDatesPreservingSpan({
      deltaColumns: 1,
      startDate: "2026-06-04",
      endDate: "2026-06-05",
      columns: weekendsHiddenColumns,
    });
    expect(toKeys(result)).toEqual({ startDate: "2026-06-05", endDate: "2026-06-08" });
  });

  it("preserves the visible span, not the calendar duration, across hidden weekends", () => {
    // Thu-Fri is 2 calendar days; after +1 the bar is Fri..Mon = 4 calendar days.
    // Legacy reads both new dates from the shifted visible columns, so visible
    // width is the invariant and calendar duration stretches over the gap.
    const result = moveDatesPreservingSpan({
      deltaColumns: 1,
      startDate: "2026-06-04",
      endDate: "2026-06-05",
      columns: weekendsHiddenColumns,
    });
    expect(result).not.toBeNull();
    const calendarDays =
      (result!.endDate.getTime() - result!.startDate.getTime()) / 86_400_000 + 1;
    expect(calendarDays).toBe(4);
  });

  it("skips hidden weekend days when shifting left (Mon-Tue -1 lands Fri-Mon)", () => {
    const result = moveDatesPreservingSpan({
      deltaColumns: -1,
      startDate: "2026-06-08",
      endDate: "2026-06-09",
      columns: weekendsHiddenColumns,
    });
    expect(toKeys(result)).toEqual({ startDate: "2026-06-05", endDate: "2026-06-08" });
  });

  it("clamps the shift at the right wall while preserving the visible span", () => {
    // Mon Jun 8 - Tue Jun 9 (indices 5-6) moved +10: delta clamps to +3,
    // landing on Thu Jun 11 - Fri Jun 12 (indices 8-9)
    const result = moveDatesPreservingSpan({
      deltaColumns: 10,
      startDate: "2026-06-08",
      endDate: "2026-06-09",
      columns: weekendsHiddenColumns,
    });
    expect(toKeys(result)).toEqual({ startDate: "2026-06-11", endDate: "2026-06-12" });
  });

  it("clamps the shift at the left wall while preserving the visible span", () => {
    // Tue Jun 2 - Wed Jun 3 (indices 1-2) moved -5: delta clamps to -1
    const result = moveDatesPreservingSpan({
      deltaColumns: -5,
      startDate: "2026-06-02",
      endDate: "2026-06-03",
      columns: weekendsHiddenColumns,
    });
    expect(toKeys(result)).toEqual({ startDate: "2026-06-01", endDate: "2026-06-02" });
  });

  it("anchors a hidden-weekend start date to the previous visible column (legacy floor lookup)", () => {
    // Legacy findVisibleIndex falls back to the LAST visible day <= date, so a
    // Sat Jun 6 start renders (and drags) from the Fri Jun 5 column. Sat-Mon
    // occupies columns 4-5; +1 moves it to columns 5-6 = Mon Jun 8 - Tue Jun 9.
    const result = moveDatesPreservingSpan({
      deltaColumns: 1,
      startDate: "2026-06-06",
      endDate: "2026-06-08",
      columns: weekendsHiddenColumns,
    });
    expect(toKeys(result)).toEqual({ startDate: "2026-06-08", endDate: "2026-06-09" });
  });

  it("collapses a weekend-only assignment onto the previous visible column (legacy quirk)", () => {
    // Sat-Sun with weekends hidden: both edges floor to Fri Jun 5 (index 4),
    // exactly how the legacy block renders it; +1 yields a 1-day Mon Jun 8 bar.
    const result = moveDatesPreservingSpan({
      deltaColumns: 1,
      startDate: "2026-06-06",
      endDate: "2026-06-07",
      columns: weekendsHiddenColumns,
    });
    expect(toKeys(result)).toEqual({ startDate: "2026-06-08", endDate: "2026-06-08" });
  });

  it("clamps a start date that precedes the visible range to the first column", () => {
    // mirrors getAssignmentBlockPosition: startVisibleIdx -1 -> 0
    const result = moveDatesPreservingSpan({
      deltaColumns: 1,
      startDate: "2026-05-28",
      endDate: "2026-06-02",
      columns: weekendsHiddenColumns,
    });
    expect(toKeys(result)).toEqual({ startDate: "2026-06-02", endDate: "2026-06-03" });
  });

  it("does not skip weekend dates when weekend columns are visible", () => {
    // With weekends shown the columns array contains Sat/Sun, so Thu-Fri +1
    // lands Fri-Sat: the skip behavior lives in the columns, not this function.
    const result = moveDatesPreservingSpan({
      deltaColumns: 1,
      startDate: "2026-06-04",
      endDate: "2026-06-05",
      columns: weekendsVisibleColumns,
    });
    expect(toKeys(result)).toEqual({ startDate: "2026-06-05", endDate: "2026-06-06" });
  });

  it("returns the original dates for a zero delta", () => {
    const result = moveDatesPreservingSpan({
      deltaColumns: 0,
      startDate: "2026-06-04",
      endDate: "2026-06-05",
      columns: weekendsHiddenColumns,
    });
    expect(toKeys(result)).toEqual({ startDate: "2026-06-04", endDate: "2026-06-05" });
  });

  it("returns null when the assignment ends before the visible range", () => {
    const result = moveDatesPreservingSpan({
      deltaColumns: 1,
      startDate: "2026-05-18",
      endDate: "2026-05-22",
      columns: weekendsHiddenColumns,
    });
    expect(result).toBeNull();
  });

  it("returns null when the assignment starts after the visible range", () => {
    const result = moveDatesPreservingSpan({
      deltaColumns: -1,
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      columns: weekendsHiddenColumns,
    });
    expect(result).toBeNull();
  });

  it("returns null when there are no visible columns", () => {
    const result = moveDatesPreservingSpan({
      deltaColumns: 1,
      startDate: "2026-06-04",
      endDate: "2026-06-05",
      columns: [],
    });
    expect(result).toBeNull();
  });
});
