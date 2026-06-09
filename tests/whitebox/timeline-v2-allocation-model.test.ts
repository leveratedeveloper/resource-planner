import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { buildTimelineV2AllocationCells } from "@/lib/timeline-v2/row-model";
import type { TimelineV2Resource } from "@/lib/timeline-v2/types";

const resource = {
  id: "employee-1",
  name: "Ada Lovelace",
  role: "Designer",
  department: "Creative",
  capacity: 40,
  employee: {
    id: "employee-1",
    employeeNumber: null,
    fullName: "Ada Lovelace",
    nickname: "Ada",
    email: null,
    photo: null,
    position: "Designer",
    departmentId: "dept-1",
    businessUnitId: null,
    directSupervisorId: null,
    weeklyCapacity: 40,
    workStartDate: null,
    dateOfBirth: null,
    employmentStatus: "active",
    visibility: "active",
    gender: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    department: { id: "dept-1", name: "Creative", color: "#111827" },
    assignments: [],
    employeeBrandAssignments: [],
  },
} as TimelineV2Resource;

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: overrides.id ?? "assignment-1",
    employeeId: overrides.employeeId ?? "employee-1",
    projectId: overrides.projectId ?? "project-1",
    taskId: null,
    startDate: overrides.startDate ?? "2026-06-01",
    endDate: overrides.endDate ?? "2026-06-01",
    hoursPerDay: overrides.hoursPerDay ?? "8",
    totalHours: null,
    allocationPercentage: null,
    isTimeOff: overrides.isTimeOff ?? false,
    isAdjustment: false,
    timeOffTypeId: null,
    category: "Other",
    isBillable: true,
    status: "draft",
    note: null,
    createdById: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function actualAssignment(overrides: Partial<ActualAssignment> = {}): ActualAssignment {
  return {
    uuid: overrides.uuid ?? "actual-1",
    employeeUuid: overrides.employeeUuid ?? "employee-1",
    projectUuid: overrides.projectUuid ?? "project-1",
    taskUuid: null,
    startDate: overrides.startDate ?? "2026-06-01",
    endDate: overrides.endDate ?? "2026-06-01",
    hoursPerDay: overrides.hoursPerDay ?? 4,
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
  };
}

describe("timeline-v2 prepared allocation cells", () => {
  it("wraps the existing allocation model with stable cell metadata", () => {
    const cells = buildTimelineV2AllocationCells({
      resource,
      assignments: [assignment({ hoursPerDay: "4" })],
      actualAssignments: [actualAssignment({ hoursPerDay: 2 })],
      days: [new Date("2026-06-01T00:00:00")],
      viewMode: "month",
    });

    expect(cells).toEqual([
      {
        id: "employee-1-2026-06-01",
        employeeId: "employee-1",
        date: "2026-06-01",
        model: expect.objectContaining({
          kind: "allocation",
          planPct: 0.5,
          actualPct: 0.25,
          planLabel: "50%",
          actualLabel: "25%",
        }),
      },
    ]);
  });

  it("uses month-range allocation behavior for quarter, half-year, and year views", () => {
    const cells = buildTimelineV2AllocationCells({
      resource,
      assignments: [
        assignment({
          startDate: "2026-06-01",
          endDate: "2026-06-30",
          hoursPerDay: "4",
        }),
      ],
      actualAssignments: [],
      days: [new Date("2026-06-01T00:00:00")],
      viewMode: "quarter",
    });

    expect(cells[0].model).toMatchObject({
      kind: "allocation",
      planPct: 0.5,
      planLabel: "50%",
    });
  });
});
