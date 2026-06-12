import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  buildEmployeeRowModels,
  buildTimelineV2Rows,
  groupTimelineV2AssignmentsByEmployee,
} from "@/lib/timeline-v2/row-model";

const employee = (id: string, name: string): Employee => ({
  id,
  employeeNumber: null,
  fullName: name,
  nickname: name,
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
}) as Employee;

const assignment = (overrides: Partial<Assignment>): Assignment => ({
  id: overrides.id ?? "assignment-1",
  employeeId: overrides.employeeId ?? "employee-1",
  projectId: overrides.projectId ?? "project-1",
  taskId: null,
  startDate: overrides.startDate ?? "2026-06-01",
  endDate: overrides.endDate ?? "2026-06-05",
  hoursPerDay: overrides.hoursPerDay ?? "8",
  totalHours: overrides.totalHours ?? null,
  allocationPercentage: null,
  isTimeOff: overrides.isTimeOff ?? false,
  isAdjustment: overrides.isAdjustment ?? false,
  timeOffTypeId: null,
  category: "Other",
  isBillable: true,
  status: "draft",
  note: overrides.note ?? null,
  createdById: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
});

const actualAssignment = (overrides: Partial<ActualAssignment> = {}): ActualAssignment => ({
  uuid: overrides.uuid ?? "actual-1",
  employeeUuid: overrides.employeeUuid ?? "employee-1",
  projectUuid: overrides.projectUuid ?? "project-actual-only",
  taskUuid: null,
  startDate: overrides.startDate ?? "2026-06-01",
  endDate: overrides.endDate ?? "2026-06-05",
  hoursPerDay: overrides.hoursPerDay ?? 8,
  allocationPercentage: null,
  isTimeOff: overrides.isTimeOff ?? false,
  timeOffTypeUuid: null,
  category: "Other",
  isBillable: true,
  status: "draft",
  note: overrides.note ?? null,
  createdByUuid: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
});

const project = (id: string): ProjectOption => ({
  id,
  name: `Project ${id}`,
  color: "#2563eb",
  status: "active",
  projectType: "campaign",
  brandId: "brand-1",
  startDate: null,
  endDate: null,
});

function dateRange(startDay: number, endDay: number) {
  const dates: Date[] = [];

  for (let day = startDay; day <= endDay; day += 1) {
    dates.push(new Date(`2026-06-${String(day).padStart(2, "0")}T00:00:00`));
  }

  return dates;
}

describe("timeline-v2 row model", () => {
  it("groups assignments by employee", () => {
    const grouped = groupTimelineV2AssignmentsByEmployee([
      assignment({ id: "a", employeeId: "employee-1" }),
      assignment({ id: "b", employeeId: "employee-2" }),
      assignment({ id: "c", employeeId: "employee-1" }),
    ]);

    expect(grouped.get("employee-1")?.map((item) => item.id)).toEqual(["a", "c"]);
    expect(grouped.get("employee-2")?.map((item) => item.id)).toEqual(["b"]);
  });

  it("builds expanded row groups while ignoring legacy time-off assignments", () => {
    const rows = buildTimelineV2Rows({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({ id: "plan-1", employeeId: "employee-1", projectId: "project-1" }),
        assignment({ id: "off-1", employeeId: "employee-1", projectId: null, isTimeOff: true }),
      ],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById: new Map([["brand-1", { id: "brand-1", name: "Brand One", color: "#000000" }]]),
      expandedEmployeeIds: new Set(["employee-1"]),
      filters: { brandId: "brand-1", department: null, projectId: null, searchQuery: "" },
      days: dateRange(1, 18),
      viewMode: "month",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].resource.name).toBe("Ada Lovelace");
    expect(rows[0].assignments.map((item) => item.id)).toEqual(["plan-1"]);
    expect(rows[0].campaignGroups[0].name).toBe("Project project-1");
    expect(rows[0].campaignGroups[0].row.project.id).toBe("project-1");
    expect(rows[0].campaignGroups[0].row.planAssignments.map((item) => item.id)).toEqual(["plan-1"]);
  });

  it("builds expanded campaign groups from planned assignments only", () => {
    const plan = assignment({
      id: "plan-1",
      employeeId: "employee-1",
      projectId: "project-plan",
    });
    const actual = actualAssignment({
      uuid: "actual-1",
      employeeUuid: "employee-1",
      projectUuid: "project-actual-only",
    });

    const rows = buildTimelineV2Rows({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [plan],
      actualAssignments: [actual],
      projects: [project("project-plan"), project("project-actual-only")],
      brandById: new Map([["brand-1", { id: "brand-1", name: "Brand One", color: "#000000" }]]),
      expandedEmployeeIds: new Set(["employee-1"]),
      filters: { brandId: null, department: null, projectId: null, searchQuery: "" },
      days: dateRange(1, 18),
      viewMode: "month",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].campaignGroups.map((group) => group.name)).toEqual(["Project project-plan"]);
    expect(rows[0].campaignGroups[0].row.planAssignments).toEqual([plan]);
    expect(rows[0].actualAssignments).toEqual([actual]);
  });

  it("exposes raw campaign assignments and merged display segments", () => {
    const first = assignment({
      id: "plan-1",
      employeeId: "employee-1",
      projectId: "project-1",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
    });
    const second = assignment({
      id: "plan-2",
      employeeId: "employee-1",
      projectId: "project-1",
      startDate: "2026-06-11",
      endDate: "2026-06-18",
    });

    const rows = buildTimelineV2Rows({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [first, second],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById: new Map([["brand-1", { id: "brand-1", name: "Brand One", color: "#000000" }]]),
      expandedEmployeeIds: new Set(["employee-1"]),
      filters: { brandId: null, department: null, projectId: null, searchQuery: "" },
      days: dateRange(1, 18),
      viewMode: "month",
    });

    const campaignRow = rows[0].campaignGroups[0].row;

    expect(campaignRow.planAssignments).toEqual([first, second]);
    expect(campaignRow.planDisplaySegments).toHaveLength(1);
    expect(campaignRow.planDisplaySegments[0]).toMatchObject({
      startDate: "2026-06-01",
      endDate: "2026-06-18",
      sourceAssignment: first,
      assignments: [first, second],
    });
  });

  it("uses visible assignment coverage instead of raw campaign dates for display segment boundaries", () => {
    const campaign = {
      ...project("project-1"),
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    };

    const rows = buildTimelineV2Rows({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({
          id: "week-1",
          employeeId: "employee-1",
          projectId: "project-1",
          startDate: "2026-06-01",
          endDate: "2026-06-05",
        }),
        assignment({
          id: "week-2",
          employeeId: "employee-1",
          projectId: "project-1",
          startDate: "2026-06-08",
          endDate: "2026-06-12",
        }),
      ],
      actualAssignments: [],
      projects: [campaign],
      brandById: new Map([["brand-1", { id: "brand-1", name: "Brand One", color: "#000000" }]]),
      expandedEmployeeIds: new Set(["employee-1"]),
      filters: { brandId: null, department: null, projectId: null, searchQuery: "" },
      days: [
        new Date("2026-06-01T00:00:00"),
        new Date("2026-06-02T00:00:00"),
        new Date("2026-06-03T00:00:00"),
        new Date("2026-06-04T00:00:00"),
        new Date("2026-06-05T00:00:00"),
        new Date("2026-06-08T00:00:00"),
        new Date("2026-06-09T00:00:00"),
        new Date("2026-06-10T00:00:00"),
        new Date("2026-06-11T00:00:00"),
        new Date("2026-06-12T00:00:00"),
      ],
      viewMode: "month",
    });

    expect(rows[0].campaignGroups[0].row.planDisplaySegments).toEqual([
      expect.objectContaining({
        startDate: "2026-06-01",
        endDate: "2026-06-12",
        assignments: [
          expect.objectContaining({ id: "week-1" }),
          expect.objectContaining({ id: "week-2" }),
        ],
      }),
    ]);
  });

  it("omits expanded campaign rows when they have no visible display segment", () => {
    const rows = buildTimelineV2Rows({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({
          id: "out-of-range",
          employeeId: "employee-1",
          projectId: "project-1",
          startDate: "2026-07-01",
          endDate: "2026-07-31",
        }),
      ],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById: new Map([["brand-1", { id: "brand-1", name: "Brand One", color: "#000000" }]]),
      expandedEmployeeIds: new Set(["employee-1"]),
      filters: { brandId: null, department: null, projectId: null, searchQuery: "" },
      days: dateRange(1, 30),
      viewMode: "month",
    });

    expect(rows[0].assignments.map((item) => item.id)).toEqual(["out-of-range"]);
    expect(rows[0].campaignGroups).toEqual([]);
  });

  it("keeps the employees it receives without re-filtering them away", () => {
    const rows = buildTimelineV2Rows({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [],
      actualAssignments: [],
      projects: [],
      brandById: new Map(),
      expandedEmployeeIds: new Set(),
      filters: { brandId: "brand-mismatch", department: null, projectId: null, searchQuery: "" },
      days: [new Date("2026-06-01T00:00:00")],
      viewMode: "month",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].resource.name).toBe("Ada Lovelace");
  });

  it("prepares one allocation cell per visible day for each row", () => {
    const rows = buildTimelineV2Rows({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({
          id: "plan-1",
          employeeId: "employee-1",
          projectId: "project-1",
          startDate: "2026-06-01",
          endDate: "2026-06-03",
          hoursPerDay: "4",
        }),
      ],
      actualAssignments: [
        actualAssignment({
          uuid: "actual-1",
          employeeUuid: "employee-1",
          startDate: "2026-06-02",
          endDate: "2026-06-02",
          hoursPerDay: 2,
        }),
      ],
      projects: [project("project-1")],
      brandById: new Map([["brand-1", { id: "brand-1", name: "Brand One", color: "#000000" }]]),
      expandedEmployeeIds: new Set(),
      filters: { brandId: null, department: null, projectId: null, searchQuery: "" },
      days: [
        new Date("2026-06-01T00:00:00"),
        new Date("2026-06-02T00:00:00"),
        new Date("2026-06-03T00:00:00"),
      ],
      viewMode: "month",
    });

    expect(rows[0].allocationCells).toHaveLength(3);
    expect(rows[0].allocationCells.map((cell) => cell.date)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
    expect(rows[0].allocationCells.map((cell) => cell.model)).toEqual([
      expect.objectContaining({ kind: "allocation", planPct: 0.5, actualPct: 0, planLabel: "50%" }),
      expect.objectContaining({ kind: "allocation", planPct: 0.5, actualPct: 0.25, planLabel: "50%", actualLabel: "25%" }),
      expect.objectContaining({ kind: "allocation", planPct: 0.5, actualPct: 0, planLabel: "50%" }),
    ]);
  });

  it("ignores legacy time-off records when preparing allocation cells", () => {
    const rows = buildTimelineV2Rows({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({
          id: "legacy-time-off",
          employeeId: "employee-1",
          projectId: null,
          isTimeOff: true,
          isBillable: false,
          startDate: "2026-06-01",
          endDate: "2026-06-01",
        }),
      ],
      actualAssignments: [],
      projects: [],
      brandById: new Map(),
      expandedEmployeeIds: new Set(),
      filters: { brandId: null, department: null, projectId: null, searchQuery: "" },
      days: [new Date("2026-06-01T00:00:00")],
      viewMode: "month",
    });

    expect(rows[0].allocationCells).toEqual([
      {
        id: "employee-1-2026-06-01",
        employeeId: "employee-1",
        date: "2026-06-01",
        model: { kind: "empty" },
      },
    ]);
  });

  it("prepares allocation cells from only the current employee row data", () => {
    const rows = buildTimelineV2Rows({
      employees: [
        employee("employee-1", "Ada Lovelace"),
        employee("employee-2", "Grace Hopper"),
      ],
      assignments: [
        assignment({
          id: "plan-1",
          employeeId: "employee-1",
          projectId: "project-1",
          startDate: "2026-06-01",
          endDate: "2026-06-01",
          hoursPerDay: "8",
        }),
        assignment({
          id: "plan-2",
          employeeId: "employee-2",
          projectId: "project-1",
          startDate: "2026-06-01",
          endDate: "2026-06-01",
          hoursPerDay: "4",
        }),
      ],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById: new Map(),
      expandedEmployeeIds: new Set(),
      filters: { brandId: null, department: null, projectId: null, searchQuery: "" },
      days: [new Date("2026-06-01T00:00:00")],
      viewMode: "month",
    });

    expect(rows[0].allocationCells[0].model).toMatchObject({
      kind: "allocation",
      planPct: 1,
      planLabel: "100%",
    });
    expect(rows[1].allocationCells[0].model).toMatchObject({
      kind: "allocation",
      planPct: 0.5,
      planLabel: "50%",
    });
  });
});

describe("timeline-v2 employee row models (filter-free rework model)", () => {
  const fixture = () => ({
    employees: [employee("employee-1", "Ada Lovelace"), employee("employee-2", "Grace Hopper")],
    assignments: [
      assignment({ id: "plan-1", employeeId: "employee-1", projectId: "project-b", startDate: "2026-06-01", endDate: "2026-06-05", hoursPerDay: "4" }),
      assignment({ id: "plan-2", employeeId: "employee-1", projectId: "project-a", startDate: "2026-06-08", endDate: "2026-06-12", hoursPerDay: "8" }),
      assignment({ id: "off-1", employeeId: "employee-1", projectId: null, isTimeOff: true, startDate: "2026-06-03", endDate: "2026-06-03" }),
      assignment({ id: "plan-3", employeeId: "employee-2", projectId: "project-a", startDate: "2026-06-02", endDate: "2026-06-04", hoursPerDay: "2" }),
    ],
    actualAssignments: [
      actualAssignment({ uuid: "actual-1", employeeUuid: "employee-1", startDate: "2026-06-02", endDate: "2026-06-02", hoursPerDay: 2 }),
    ],
    projects: [project("project-a"), project("project-b")],
    brandById: new Map<string, Brand>([
      ["brand-1", { id: "brand-1", name: "Brand One", color: "#000000" } as Brand],
    ]),
    days: dateRange(1, 18),
    viewMode: "month" as const,
  });

  it("returns a map keyed by employee id, keeping employees without lanes", () => {
    const input = fixture();
    const models = buildEmployeeRowModels({
      ...input,
      employees: [...input.employees, employee("employee-3", "No Assignments")],
    });

    expect([...models.keys()]).toEqual(["employee-1", "employee-2", "employee-3"]);
    expect(models.get("employee-3")?.projectLanes).toEqual([]);
    expect(models.get("employee-3")?.allocationCells).toHaveLength(18);
  });

  it("keeps lanes in assignment insertion order without highlight flags", () => {
    const models = buildEmployeeRowModels(fixture());
    const lanes = models.get("employee-1")?.projectLanes ?? [];

    // plan-1 (project-b) precedes plan-2 (project-a) — insertion order, no sorting.
    expect(lanes.map((lane) => lane.projectId)).toEqual(["project-b", "project-a"]);
    expect(lanes.every((lane) => !("isHighlighted" in lane))).toBe(true);
  });

  it("excludes time-off assignments from row assignments and lanes", () => {
    const models = buildEmployeeRowModels(fixture());

    expect(models.get("employee-1")?.assignments.map((item) => item.id)).toEqual(["plan-1", "plan-2"]);
  });

  it("produces allocation cells identical to the legacy row builder", () => {
    const input = fixture();
    const models = buildEmployeeRowModels(input);
    const legacyRows = buildTimelineV2Rows({
      employees: input.employees,
      assignments: input.assignments,
      actualAssignments: input.actualAssignments,
      projects: input.projects,
      brandById: input.brandById,
      expandedEmployeeIds: new Set(),
      filters: { brandId: null, department: null, projectId: null, searchQuery: "" },
      days: input.days,
      viewMode: input.viewMode,
    });

    for (const legacyRow of legacyRows) {
      const model = models.get(legacyRow.id);
      expect(model?.allocationCells).toEqual(legacyRow.allocationCells);
    }
    // Guard against vacuous parity: the fixture must produce real allocations.
    expect(
      legacyRows.some((row) => row.allocationCells.some((cell) => cell.model.kind === "allocation"))
    ).toBe(true);
  });

  it("produces allocation cells identical to the legacy builder in month-range views", () => {
    const input = { ...fixture(), viewMode: "quarter" as const, days: [new Date("2026-04-01T00:00:00"), new Date("2026-05-01T00:00:00"), new Date("2026-06-01T00:00:00")] };
    const models = buildEmployeeRowModels(input);
    const legacyRows = buildTimelineV2Rows({
      employees: input.employees,
      assignments: input.assignments,
      actualAssignments: input.actualAssignments,
      projects: input.projects,
      brandById: input.brandById,
      expandedEmployeeIds: new Set(),
      filters: { brandId: null, department: null, projectId: null, searchQuery: "" },
      days: input.days,
      viewMode: input.viewMode,
    });

    for (const legacyRow of legacyRows) {
      expect(models.get(legacyRow.id)?.allocationCells).toEqual(legacyRow.allocationCells);
    }
    expect(
      legacyRows.some((row) => row.allocationCells.some((cell) => cell.model.kind === "allocation"))
    ).toBe(true);
  });

  it("matches the legacy builder's lane contents per project", () => {
    const input = fixture();
    const models = buildEmployeeRowModels(input);
    const legacyRows = buildTimelineV2Rows({
      employees: input.employees,
      assignments: input.assignments,
      actualAssignments: input.actualAssignments,
      projects: input.projects,
      brandById: input.brandById,
      expandedEmployeeIds: new Set(["employee-1", "employee-2"]),
      filters: { brandId: null, department: null, projectId: null, searchQuery: "" },
      days: input.days,
      viewMode: input.viewMode,
    });

    for (const legacyRow of legacyRows) {
      const lanesByProject = new Map(
        (models.get(legacyRow.id)?.projectLanes ?? []).map((lane) => [lane.projectId, lane])
      );
      for (const group of legacyRow.campaignGroups) {
        const lane = lanesByProject.get(group.row.project.id);
        expect(lane?.planAssignments).toEqual(group.row.planAssignments);
        expect(lane?.planDisplaySegments).toEqual(group.row.planDisplaySegments);
        expect(lane?.brand).toEqual(group.row.brand);
      }
    }
  });
});
