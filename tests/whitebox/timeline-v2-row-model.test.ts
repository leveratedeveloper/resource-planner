import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  buildEmployeeRowModels,
  groupTimelineAssignmentsByEmployee,
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

const brandById = new Map<string, Brand>([
  ["brand-1", { id: "brand-1", name: "Brand One", color: "#000000" } as Brand],
]);

function dateRange(startDay: number, endDay: number) {
  const dates: Date[] = [];

  for (let day = startDay; day <= endDay; day += 1) {
    dates.push(new Date(`2026-06-${String(day).padStart(2, "0")}T00:00:00`));
  }

  return dates;
}

describe("timeline-v2 row model", () => {
  it("groups assignments by employee", () => {
    const grouped = groupTimelineAssignmentsByEmployee([
      assignment({ id: "a", employeeId: "employee-1" }),
      assignment({ id: "b", employeeId: "employee-2" }),
      assignment({ id: "c", employeeId: "employee-1" }),
    ]);

    expect(grouped.get("employee-1")?.map((item) => item.id)).toEqual(["a", "c"]);
    expect(grouped.get("employee-2")?.map((item) => item.id)).toEqual(["b"]);
  });

  it("returns a map keyed by employee id, keeping employees without lanes", () => {
    const models = buildEmployeeRowModels({
      employees: [employee("employee-1", "Ada Lovelace"), employee("employee-2", "No Assignments")],
      assignments: [assignment({ id: "plan-1", employeeId: "employee-1", projectId: "project-1" })],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById,
      days: dateRange(1, 18),
      viewMode: "month",
    });

    expect([...models.keys()]).toEqual(["employee-1", "employee-2"]);
    expect(models.get("employee-1")?.resource.name).toBe("Ada Lovelace");
    expect(models.get("employee-2")?.projectLanes).toEqual([]);
    expect(models.get("employee-2")?.allocationCells).toHaveLength(18);
  });

  it("builds lanes from planned assignments while ignoring time-off rows", () => {
    const models = buildEmployeeRowModels({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({ id: "plan-1", employeeId: "employee-1", projectId: "project-1" }),
        assignment({ id: "off-1", employeeId: "employee-1", projectId: null, isTimeOff: true }),
      ],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById,
      days: dateRange(1, 18),
      viewMode: "month",
    });

    const model = models.get("employee-1")!;
    expect(model.assignments.map((item) => item.id)).toEqual(["plan-1"]);
    expect(model.projectLanes.map((lane) => lane.projectId)).toEqual(["project-1"]);
    expect(model.projectLanes[0].project.name).toBe("Project project-1");
    expect(model.projectLanes[0].planAssignments.map((item) => item.id)).toEqual(["plan-1"]);
    expect(model.projectLanes[0].brand?.name).toBe("Brand One");
  });

  it("keeps lanes in assignment insertion order without highlight flags", () => {
    const models = buildEmployeeRowModels({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({ id: "plan-1", employeeId: "employee-1", projectId: "project-b" }),
        assignment({ id: "plan-2", employeeId: "employee-1", projectId: "project-a", startDate: "2026-06-08", endDate: "2026-06-12" }),
      ],
      actualAssignments: [],
      projects: [project("project-a"), project("project-b")],
      brandById,
      days: dateRange(1, 18),
      viewMode: "month",
    });

    const lanes = models.get("employee-1")?.projectLanes ?? [];
    expect(lanes.map((lane) => lane.projectId)).toEqual(["project-b", "project-a"]);
    expect(lanes.every((lane) => !("isHighlighted" in lane))).toBe(true);
  });

  it("merges contiguous assignments into one display segment", () => {
    const first = assignment({ id: "plan-1", projectId: "project-1", startDate: "2026-06-01", endDate: "2026-06-10" });
    const second = assignment({ id: "plan-2", projectId: "project-1", startDate: "2026-06-11", endDate: "2026-06-18" });

    const models = buildEmployeeRowModels({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [first, second],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById,
      days: dateRange(1, 18),
      viewMode: "month",
    });

    const lane = models.get("employee-1")!.projectLanes[0];
    expect(lane.planAssignments).toEqual([first, second]);
    expect(lane.planDisplaySegments).toHaveLength(1);
    expect(lane.planDisplaySegments[0]).toMatchObject({
      startDate: "2026-06-01",
      endDate: "2026-06-18",
      sourceAssignment: first,
      assignments: [first, second],
    });
  });

  it("omits lanes when no display segment is visible in the range", () => {
    const models = buildEmployeeRowModels({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({ id: "out-of-range", projectId: "project-1", startDate: "2026-07-01", endDate: "2026-07-31" }),
      ],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById,
      days: dateRange(1, 30),
      viewMode: "month",
    });

    const model = models.get("employee-1")!;
    expect(model.assignments.map((item) => item.id)).toEqual(["out-of-range"]);
    expect(model.projectLanes).toEqual([]);
  });

  it("prepares one allocation cell per visible day with plan and actual percentages", () => {
    const models = buildEmployeeRowModels({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({ id: "plan-1", projectId: "project-1", startDate: "2026-06-01", endDate: "2026-06-03", hoursPerDay: "4" }),
      ],
      actualAssignments: [
        actualAssignment({ uuid: "actual-1", startDate: "2026-06-02", endDate: "2026-06-02", hoursPerDay: 2 }),
      ],
      projects: [project("project-1")],
      brandById,
      days: [
        new Date("2026-06-01T00:00:00"),
        new Date("2026-06-02T00:00:00"),
        new Date("2026-06-03T00:00:00"),
      ],
      viewMode: "month",
    });

    const cells = models.get("employee-1")!.allocationCells;
    expect(cells.map((cell) => cell.date)).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
    expect(cells.map((cell) => cell.model)).toEqual([
      expect.objectContaining({ kind: "allocation", planPct: 0.5, actualPct: 0, planLabel: "50%" }),
      expect.objectContaining({ kind: "allocation", planPct: 0.5, actualPct: 0.25, planLabel: "50%", actualLabel: "25%" }),
      expect.objectContaining({ kind: "allocation", planPct: 0.5, actualPct: 0, planLabel: "50%" }),
    ]);
  });

  it("ignores time-off records when preparing allocation cells", () => {
    const models = buildEmployeeRowModels({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({ id: "legacy-time-off", projectId: null, isTimeOff: true, startDate: "2026-06-01", endDate: "2026-06-01" }),
      ],
      actualAssignments: [],
      projects: [],
      brandById: new Map(),
      days: [new Date("2026-06-01T00:00:00")],
      viewMode: "month",
    });

    expect(models.get("employee-1")!.allocationCells).toEqual([
      {
        id: "employee-1-2026-06-01",
        employeeId: "employee-1",
        date: "2026-06-01",
        model: { kind: "empty" },
      },
    ]);
  });

  it("prepares allocation cells from only the current employee's data", () => {
    const models = buildEmployeeRowModels({
      employees: [employee("employee-1", "Ada Lovelace"), employee("employee-2", "Grace Hopper")],
      assignments: [
        assignment({ id: "plan-1", employeeId: "employee-1", projectId: "project-1", startDate: "2026-06-01", endDate: "2026-06-01", hoursPerDay: "8" }),
        assignment({ id: "plan-2", employeeId: "employee-2", projectId: "project-1", startDate: "2026-06-01", endDate: "2026-06-01", hoursPerDay: "4" }),
      ],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById: new Map(),
      days: [new Date("2026-06-01T00:00:00")],
      viewMode: "month",
    });

    expect(models.get("employee-1")!.allocationCells[0].model).toMatchObject({
      kind: "allocation",
      planPct: 1,
      planLabel: "100%",
    });
    expect(models.get("employee-2")!.allocationCells[0].model).toMatchObject({
      kind: "allocation",
      planPct: 0.5,
      planLabel: "50%",
    });
  });

  it("aggregates full calendar months for month-resolution views", () => {
    // 15 calendar days at 4h (60h) over 22 weekdays + 4 weekend days carrying hours
    const models = buildEmployeeRowModels({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({ id: "plan-1", projectId: "project-1", startDate: "2026-06-01", endDate: "2026-06-15", hoursPerDay: "4" }),
      ],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById,
      days: [new Date("2026-04-01T00:00:00"), new Date("2026-05-01T00:00:00"), new Date("2026-06-01T00:00:00")],
      viewMode: "quarter",
    });

    const cells = models.get("employee-1")!.allocationCells;
    expect(cells[0].model).toEqual({ kind: "empty" });
    expect(cells[1].model).toEqual({ kind: "empty" });
    // (26 counted days × 8h capacity) → 60/208 ≈ 29%.
    expect(cells[2].model).toMatchObject({ kind: "allocation", planLabel: "29%" });
  });
});
