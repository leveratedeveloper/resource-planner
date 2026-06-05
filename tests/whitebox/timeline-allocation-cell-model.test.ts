import { describe, expect, it } from "vitest";
import { getAllocationCellModel } from "@/lib/timeline/allocation-cell-model";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Resource } from "@/types";

const resource: Resource = {
  id: "emp-1",
  name: "Ada Lovelace",
  role: "Designer",
  department: "Creative",
  capacity: 40,
};

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "assignment-1",
    employeeId: "emp-1",
    projectId: "project-1",
    taskId: null,
    startDate: "2026-05-18",
    endDate: "2026-05-18",
    hoursPerDay: "8",
    totalHours: null,
    allocationPercentage: null,
    isTimeOff: false,
    isAdjustment: false,
    timeOffTypeId: null,
    category: "Design",
    isBillable: true,
    status: "draft",
    note: null,
    createdById: null,
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

function actualAssignment(overrides: Partial<ActualAssignment> = {}): ActualAssignment {
  return {
    uuid: "actual-1",
    employeeUuid: "emp-1",
    projectUuid: "project-1",
    taskUuid: null,
    startDate: "2026-05-18",
    endDate: "2026-05-18",
    hoursPerDay: 4,
    allocationPercentage: null,
    isTimeOff: false,
    timeOffTypeUuid: null,
    category: "Design",
    isBillable: true,
    status: "confirmed",
    note: null,
    createdByUuid: null,
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("timeline allocation cell model", () => {
  it("returns an empty cell when there is no planned or actual work", () => {
    const model = getAllocationCellModel({
      day: new Date("2026-05-18T00:00:00"),
      resource,
      assignments: [],
      actualAssignments: [],
      isMonthRangeView: false,
      isWeekView: false,
    });

    expect(model.kind).toBe("empty");
  });

  it("shows time off over daily allocation", () => {
    const model = getAllocationCellModel({
      day: new Date("2026-05-18T00:00:00"),
      resource,
      assignments: [assignment({ projectId: null, isTimeOff: true, isBillable: false })],
      actualAssignments: [],
      isMonthRangeView: false,
      isWeekView: false,
    });

    expect(model.kind).toBe("time-off");
  });

  it("keeps month-range cells in allocation mode when time off overlaps planned work", () => {
    const model = getAllocationCellModel({
      day: new Date("2026-04-01T00:00:00"),
      resource,
      assignments: [
        assignment({
          startDate: "2026-04-01",
          endDate: "2026-04-30",
          hoursPerDay: "4",
        }),
        assignment({
          id: "off-1",
          projectId: null,
          isTimeOff: true,
          isBillable: false,
          startDate: "2026-04-10",
          endDate: "2026-04-12",
        }),
      ],
      actualAssignments: [],
      isMonthRangeView: true,
      isWeekView: false,
    });

    expect(model).toMatchObject({
      kind: "allocation",
      planPct: 0.5,
      planLabel: "50%",
    });
  });

  it("returns an empty month cell when time off is the only record in the month", () => {
    const model = getAllocationCellModel({
      day: new Date("2026-04-01T00:00:00"),
      resource,
      assignments: [
        assignment({
          id: "off-1",
          projectId: null,
          isTimeOff: true,
          isBillable: false,
          startDate: "2026-04-10",
          endDate: "2026-04-12",
        }),
      ],
      actualAssignments: [],
      isMonthRangeView: true,
      isWeekView: false,
    });

    expect(model.kind).toBe("empty");
  });

  it("computes daily planned and actual percentages", () => {
    const model = getAllocationCellModel({
      day: new Date("2026-05-18T00:00:00"),
      resource,
      assignments: [assignment({ hoursPerDay: "4" })],
      actualAssignments: [actualAssignment({ hoursPerDay: 2 })],
      isMonthRangeView: false,
      isWeekView: false,
    });

    expect(model).toMatchObject({
      kind: "allocation",
      planPct: 0.5,
      actualPct: 0.25,
      planLabel: "50%",
      actualLabel: "25%",
    });
  });
});
