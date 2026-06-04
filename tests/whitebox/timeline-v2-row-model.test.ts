import { describe, expect, it } from "vitest";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { buildTimelineV2Rows, groupTimelineV2AssignmentsByEmployee } from "@/lib/timeline-v2/row-model";

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

const project = (id: string): ProjectOption => ({
  id,
  name: `Project ${id}`,
  color: "#2563eb",
  status: "active",
  projectType: "campaign",
  brandId: "brand-1",
});

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

  it("builds expanded row groups with campaigns and time off split out", () => {
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
      days: [new Date("2026-06-01T00:00:00")],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].resource.name).toBe("Ada Lovelace");
    expect(rows[0].timeOffAssignments.map((item) => item.id)).toEqual(["off-1"]);
    expect(rows[0].campaignGroups[0].name).toBe("Project project-1");
    expect(rows[0].campaignGroups[0].row.project.id).toBe("project-1");
    expect(rows[0].campaignGroups[0].row.planAssignments.map((item) => item.id)).toEqual(["plan-1"]);
  });
});
