import { describe, expect, it } from "vitest";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  getResourceProjects,
  groupProjectsByDeliverable,
  sortResourceProjects,
} from "@/lib/timeline/resource-project-model";

function project(overrides: Partial<ProjectOption>): ProjectOption {
  return {
    id: "project-1",
    name: "Alpha",
    color: "#2563eb",
    status: "active",
    projectType: "campaign",
    brandId: null,
    ...overrides,
  };
}

function assignment(overrides: Partial<Assignment>): Assignment {
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

function actualAssignment(overrides: Partial<ActualAssignment>): ActualAssignment {
  return {
    uuid: "actual-1",
    employeeUuid: "emp-1",
    projectUuid: "project-1",
    taskUuid: null,
    startDate: "2026-05-18",
    endDate: "2026-05-18",
    hoursPerDay: 8,
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

describe("resource project model", () => {
  it("keeps only projects with non-time-off assignments", () => {
    const projects = [project({ id: "project-1" }), project({ id: "project-2" })];
    const resourceProjects = getResourceProjects(
      [
        assignment({ id: "a1", projectId: "project-1" }),
        assignment({ id: "pto", projectId: null, isTimeOff: true }),
      ],
      projects
    );

    expect(resourceProjects.map((item) => item.id)).toEqual(["project-1"]);
  });

  it("sorts brand matches before other projects", () => {
    const sorted = sortResourceProjects({
      projects: [
        project({ id: "project-1", name: "Alpha", brandId: "brand-b" }),
        project({ id: "project-2", name: "Beta", brandId: "brand-a" }),
      ],
      resourceAssignments: [
        assignment({ id: "a1", projectId: "project-1" }),
        assignment({ id: "a2", projectId: "project-2" }),
      ],
      brandId: "brand-a",
      days: [new Date("2026-05-18T00:00:00")],
    });

    expect(sorted.map((item) => item.id)).toEqual(["project-2", "project-1"]);
  });

  it("groups projects by deliverable notes with general first", () => {
    const groups = groupProjectsByDeliverable({
      sortedProjects: [project({ id: "project-1", name: "Alpha" })],
      resourceAssignments: [
        assignment({ id: "general", projectId: "project-1", note: null }),
        assignment({ id: "named", projectId: "project-1", note: "Deliverables: Banner, Landing Page." }),
      ],
      actualAssignments: [
        actualAssignment({ uuid: "actual", projectUuid: "project-1", note: "Deliverable: Banner" }),
      ],
    });

    expect(groups.map((group) => group.name)).toEqual([null, "Banner", "Landing Page"]);
    expect(groups[1].projects[0].planAssignments.map((item) => item.id)).toEqual(["named"]);
    expect(groups[1].projects[0].actualAssignments.map((item) => item.uuid)).toEqual(["actual"]);
  });
});
