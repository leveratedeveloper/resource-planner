import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import {
  getActualAssignmentsForEmployee,
  getTimelineActualQueryParams,
  groupActualAssignmentsByEmployee,
} from "@/lib/timeline/actuals";

const makeActual = (
  uuid: string,
  employeeUuid: string,
  startDate = "2026-05-18",
  endDate = "2026-05-18"
): ActualAssignment => ({
  uuid,
  employeeUuid,
  projectUuid: "project-1",
  taskUuid: null,
  startDate,
  endDate,
  hoursPerDay: 8,
  allocationPercentage: null,
  isTimeOff: false,
  timeOffTypeUuid: null,
  category: "Delivery",
  isBillable: true,
  status: "confirmed",
  note: null,
  createdByUuid: "creator-1",
  createdAt: "2026-05-18T00:00:00.000Z",
  updatedAt: "2026-05-18T00:00:00.000Z",
});

describe("timeline actual assignment performance helpers", () => {
  it("groups actual assignments by employee without mutating objects", () => {
    const first = makeActual("actual-1", "employee-a");
    const second = makeActual("actual-2", "employee-b");
    const third = makeActual("actual-3", "employee-a");

    const grouped = groupActualAssignmentsByEmployee([first, second, third]);

    expect(grouped.get("employee-a")).toEqual([first, third]);
    expect(grouped.get("employee-b")).toEqual([second]);
    expect(grouped.get("employee-a")?.[0]).toBe(first);
  });

  it("returns an empty actual list for employees with no actual assignments", () => {
    const grouped = groupActualAssignmentsByEmployee([
      makeActual("actual-1", "employee-a"),
    ]);

    expect(getActualAssignmentsForEmployee(grouped, "employee-missing")).toEqual([]);
  });

  it("plans one actual query per visible date range regardless of employee count", () => {
    const days = [
      new Date(2026, 4, 18),
      new Date(2026, 4, 19),
      new Date(2026, 4, 20),
      new Date(2026, 4, 21),
      new Date(2026, 4, 22),
    ];

    const plan = getTimelineActualQueryParams(days);

    expect(plan).toEqual({
      start_date: "2026-05-18",
      end_date: "2026-05-22",
    });
  });

  it("changes the actual query range when the visible date range changes", () => {
    const firstRange = getTimelineActualQueryParams([
      new Date(2026, 4, 18),
      new Date(2026, 4, 22),
    ]);
    const secondRange = getTimelineActualQueryParams([
      new Date(2026, 4, 25),
      new Date(2026, 4, 29),
    ]);

    expect(firstRange).not.toEqual(secondRange);
    expect(secondRange).toEqual({
      start_date: "2026-05-25",
      end_date: "2026-05-29",
    });
  });

  it("groups a large actual assignment set by employee", () => {
    const actuals = Array.from({ length: 10_000 }, (_, index) =>
      makeActual(`actual-${index}`, `employee-${index % 100}`)
    );

    const grouped = groupActualAssignmentsByEmployee(actuals);

    expect(grouped.size).toBe(100);
    expect(grouped.get("employee-0")).toHaveLength(100);
  });
});
