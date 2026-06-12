import { endOfMonth, startOfMonth } from "date-fns";
import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { getAllocationCellModel as getLegacyAllocationCellModel } from "@/lib/timeline/allocation-cell-model";
import { buildAllocationDayMaps } from "@/lib/timeline-v2/allocation-day-map";
import { getAllocationCellModel } from "@/lib/timeline-v2/allocation-model";
import { getTimelineV2Columns } from "@/lib/timeline-v2/date-range";
import type { TimelineV2ViewMode } from "@/lib/timeline-v2/types";
import type { Resource } from "@/types";

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "assignment-1",
    employeeId: "employee-a",
    projectId: "project-1",
    taskId: null,
    startDate: "2026-06-01",
    endDate: "2026-06-01",
    hoursPerDay: "8",
    totalHours: null,
    allocationPercentage: null,
    isTimeOff: false,
    isAdjustment: false,
    timeOffTypeId: null,
    category: "Other",
    isBillable: true,
    status: "draft",
    note: null,
    createdById: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function actualAssignment(overrides: Partial<ActualAssignment> = {}): ActualAssignment {
  return {
    uuid: "actual-1",
    employeeUuid: "employee-a",
    projectUuid: "project-1",
    taskUuid: null,
    startDate: "2026-06-01",
    endDate: "2026-06-01",
    hoursPerDay: 4,
    allocationPercentage: null,
    isTimeOff: false,
    timeOffTypeUuid: null,
    category: "Other",
    isBillable: true,
    status: "confirmed",
    note: null,
    createdByUuid: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const resources: Resource[] = [
  { id: "employee-a", name: "Ada", role: "Designer", department: "Creative", capacity: 40 },
  { id: "employee-b", name: "Bea", role: "Developer", department: "Tech", capacity: 32.5 },
  // No assignments at all — must stay empty in both models.
  { id: "employee-c", name: "Cal", role: "PM", department: "Ops", capacity: 40 },
];

// Anchor: Thu 2026-06-11. Week range Mon 06-08..Sun 06-14, month June,
// quarter Apr-Jun, halfYear Jan-Jun, year Jan-Dec 2026.
const anchorDate = new Date(2026, 5, 11);

const assignments: Assignment[] = [
  // Weekday span fully inside week + month ranges.
  assignment({ id: "a-1", startDate: "2026-06-08", endDate: "2026-06-12", hoursPerDay: "8" }),
  // Comma-decimal hours, overlaps the June month-range start (outside week range).
  assignment({ id: "a-2", startDate: "2026-05-28", endDate: "2026-06-02", hoursPerDay: "7,5" }),
  // Fri..Mon weekend span, overlaps a-1 on 06-12 (multiple assignments per day)
  // and overlaps the week range end.
  assignment({ id: "a-3", startDate: "2026-06-12", endDate: "2026-06-15", hoursPerDay: "4" }),
  // Overlaps the June month-range end into July.
  assignment({
    id: "a-4",
    employeeId: "employee-b",
    startDate: "2026-06-26",
    endDate: "2026-07-03",
    hoursPerDay: "6",
  }),
  // Weekend-only span (Sat 06-13 .. Sun 06-14).
  assignment({
    id: "a-5",
    employeeId: "employee-b",
    startDate: "2026-06-13",
    endDate: "2026-06-14",
    hoursPerDay: "5",
  }),
  // Time off — excluded by both models.
  assignment({
    id: "a-6",
    startDate: "2026-06-10",
    endDate: "2026-06-10",
    hoursPerDay: "8",
    isTimeOff: true,
  }),
  // Fully outside every range (before the 2026 year view).
  assignment({ id: "a-7", startDate: "2025-12-01", endDate: "2025-12-31", hoursPerDay: "8" }),
  // Fully outside every range (after the 2026 year view).
  assignment({
    id: "a-8",
    employeeId: "employee-b",
    startDate: "2027-01-05",
    endDate: "2027-01-09",
    hoursPerDay: "8",
  }),
];

const actualAssignments: ActualAssignment[] = [
  actualAssignment({ uuid: "ac-1", startDate: "2026-06-09", endDate: "2026-06-11", hoursPerDay: 3 }),
  // Spans the weekend.
  actualAssignment({
    uuid: "ac-2",
    employeeUuid: "employee-b",
    startDate: "2026-06-12",
    endDate: "2026-06-14",
    hoursPerDay: 2,
  }),
  // Missing employeeUuid. KNOWN DIVERGENCE: the legacy model counts uuid-less
  // actuals for EVERY resource; the new day-map model skips them by spec. This
  // fixture is outside every view range so both models ignore it and parity holds.
  actualAssignment({
    uuid: "ac-3",
    employeeUuid: null as unknown as string,
    startDate: "2025-11-03",
    endDate: "2025-11-07",
    hoursPerDay: 8,
  }),
  // Time off — excluded by both models.
  actualAssignment({
    uuid: "ac-4",
    startDate: "2026-06-08",
    endDate: "2026-06-12",
    hoursPerDay: 6,
    isTimeOff: true,
  }),
  // Unknown employee — invisible to every fixture resource in both models.
  actualAssignment({
    uuid: "ac-5",
    employeeUuid: "employee-ghost",
    startDate: "2026-06-08",
    endDate: "2026-06-12",
    hoursPerDay: 4,
  }),
];

const viewModes: TimelineV2ViewMode[] = ["week", "month", "quarter", "halfYear", "year"];

describe("timeline-v2 allocation parity with the legacy cell model", () => {
  for (const viewMode of viewModes) {
    for (const showWeekends of [true, false]) {
      it(`matches legacy output for ${viewMode} view (showWeekends=${showWeekends})`, () => {
        const columnSet = getTimelineV2Columns({ anchorDate, viewMode, showWeekends });
        expect(columnSet.columns.length).toBeGreaterThan(0);

        const firstColumnDate = columnSet.columns[0].date;
        const lastColumnDate = columnSet.columns[columnSet.columns.length - 1].date;
        const isMonthResolution = columnSet.resolution === "month";
        const dayMaps = buildAllocationDayMaps({
          assignments,
          actualAssignments,
          rangeStart: isMonthResolution ? startOfMonth(firstColumnDate) : firstColumnDate,
          rangeEnd: isMonthResolution ? endOfMonth(lastColumnDate) : lastColumnDate,
        });

        let allocationCellCount = 0;

        for (const resource of resources) {
          for (const column of columnSet.columns) {
            const expected = getLegacyAllocationCellModel({
              day: column.date,
              resource,
              assignments,
              actualAssignments,
              isWeekView: viewMode === "week",
              isMonthRangeView: isMonthResolution,
            });
            const actual = getAllocationCellModel({
              dayMap: dayMaps.get(resource.id),
              day: column.date,
              viewMode,
              capacity: resource.capacity,
            });

            expect(actual, `${resource.id} @ ${column.id}`).toEqual(expected);
            if (expected.kind === "allocation") allocationCellCount += 1;
          }
        }

        // Guard against vacuous parity: the fixtures must light up real cells.
        expect(allocationCellCount).toBeGreaterThan(0);
      });
    }
  }
});
