import { describe, expect, it } from "vitest";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { filterTimelineEmployees } from "@/lib/timeline-v2/employees";

const makeEmployee = (id: string, overrides: Partial<Employee> = {}): Employee => ({
  id,
  employeeNumber: id,
  sourceEmployeeId: "FR-071",
  fullName: "Carina Hartanto",
  nickname: null,
  email: null,
  photo: null,
  position: "Designer",
  departmentId: "department-1",
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
  ...overrides,
});

const makeAssignment = (overrides: Partial<Assignment>): Assignment => ({
  id: "assignment-1",
  employeeId: "employee-1",
  projectKey: "campaign:project-1",
  startDate: "2026-06-01",
  endDate: "2026-06-01",
  status: "confirmed",
  note: null,
  allocations: [{ month: "2026-06-01", plannedHours: 160, kind: "plan" }],
  createdBy: null,
  updatedBy: null,
  ...overrides,
});

const baseInput = {
  dateFilteredAssignments: [] as Assignment[],
  projectByKey: new Map<string, ProjectOption>(),
  selectedBrandProjectKeys: new Set<string>(),
  filters: { brandIds: [], projectIds: [], departments: [], searchQuery: undefined },
};

describe("filterTimelineEmployees dedup", () => {
  it("collapses same name + same source id to a single row", () => {
    const result = filterTimelineEmployees({
      ...baseInput,
      employees: [makeEmployee("a"), makeEmployee("b"), makeEmployee("c")],
    });
    expect(result).toHaveLength(1);
  });

  it("keeps the record that has work in range", () => {
    const result = filterTimelineEmployees({
      ...baseInput,
      employees: [makeEmployee("no-work"), makeEmployee("has-work")],
      dateFilteredAssignments: [makeAssignment({ employeeId: "has-work" })],
    });
    expect(result.map((e) => e.id)).toEqual(["has-work"]);
  });

  it("prefers an active record over inactive when neither has work", () => {
    const result = filterTimelineEmployees({
      ...baseInput,
      employees: [
        makeEmployee("inactive", { employmentStatus: "inactive" }),
        makeEmployee("active", { employmentStatus: "active" }),
      ],
    });
    expect(result.map((e) => e.id)).toEqual(["active"]);
  });

  it("keeps same name with DIFFERENT source ids as separate rows", () => {
    const result = filterTimelineEmployees({
      ...baseInput,
      employees: [
        makeEmployee("kara-1", { fullName: "Kara Adinda Vegi", sourceEmployeeId: "FR-067" }),
        makeEmployee("kara-2", { fullName: "Kara Adinda Vegi", sourceEmployeeId: "S-033" }),
      ],
    });
    expect(result).toHaveLength(2);
  });

  it("keeps different people who share a reused source id as separate rows", () => {
    const result = filterTimelineEmployees({
      ...baseInput,
      employees: [
        makeEmployee("p1", { fullName: "Adhityara Rizky", sourceEmployeeId: "L-448" }),
        makeEmployee("p2", { fullName: "Femmy Kowel", sourceEmployeeId: "L-448" }),
      ],
    });
    expect(result).toHaveLength(2);
  });

  it("normalizes whitespace and case when matching names", () => {
    const result = filterTimelineEmployees({
      ...baseInput,
      employees: [
        makeEmployee("a", { fullName: "Budi  Santoso" }),
        makeEmployee("b", { fullName: "budi santoso" }),
      ],
    });
    expect(result).toHaveLength(1);
  });

  it("never merges rows that both have a null source id", () => {
    const result = filterTimelineEmployees({
      ...baseInput,
      employees: [
        makeEmployee("x", { fullName: "No Source", sourceEmployeeId: null }),
        makeEmployee("y", { fullName: "No Source", sourceEmployeeId: null }),
      ],
    });
    expect(result).toHaveLength(2);
  });
});
