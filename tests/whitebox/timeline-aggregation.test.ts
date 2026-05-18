import { describe, expect, it } from "vitest";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Department } from "@/lib/query/hooks/useDepartments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import {
  getAssignmentDepartmentId,
  groupAssignmentsByDepartment,
} from "@/components/timeline/timeline-aggregation";

function employee(id: string, departmentId: string | null): Employee {
  return {
    id,
    employeeNumber: null,
    fullName: `Employee ${id}`,
    nickname: null,
    email: null,
    photo: null,
    position: "Designer",
    departmentId,
    businessUnitId: null,
    directSupervisorId: null,
    weeklyCapacity: 40,
    workStartDate: null,
    dateOfBirth: null,
    employmentStatus: "active",
    visibility: "active",
    gender: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function department(id: string, name: string): Department {
  return {
    id,
    businessUnitId: null,
    name,
    code: "",
    color: "#2563eb",
    description: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function assignment(id: string, employeeId: string): Assignment {
  return {
    id,
    employeeId,
    projectId: "project-1",
    taskId: null,
    startDate: "2026-05-04",
    endDate: "2026-05-08",
    hoursPerDay: "8.00",
    totalHours: 40,
    allocationPercentage: null,
    isTimeOff: false,
    isAdjustment: false,
    timeOffTypeId: null,
    category: "Production",
    isBillable: true,
    status: "confirmed",
    note: null,
    createdById: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("timeline department aggregation", () => {
  it("resolves an assignment department from the employee departmentId fallback", () => {
    const employeeById = new Map([["employee-1", employee("employee-1", "dept-1")]]);
    const result = getAssignmentDepartmentId(assignment("assignment-1", "employee-1"), employeeById);

    expect(result).toBe("dept-1");
  });

  it("groups assignments by department when assignments do not include employee relations", () => {
    const employeeById = new Map([
      ["employee-1", employee("employee-1", "dept-1")],
      ["employee-2", employee("employee-2", "dept-2")],
    ]);
    const departments = [
      department("dept-1", "Creative"),
      department("dept-2", "Strategy"),
    ];

    const grouped = groupAssignmentsByDepartment({
      assignments: [
        assignment("assignment-1", "employee-1"),
        assignment("assignment-2", "employee-2"),
      ],
      departments,
      employeeById,
    });

    expect(grouped.get("dept-1")?.assignments.map((item) => item.id)).toEqual([
      "assignment-1",
    ]);
    expect(grouped.get("dept-2")?.assignments.map((item) => item.id)).toEqual([
      "assignment-2",
    ]);
  });

  it("keeps the selected department filter aligned with the grouped assignments", () => {
    const employeeById = new Map([
      ["employee-1", employee("employee-1", "dept-1")],
      ["employee-2", employee("employee-2", "dept-2")],
    ]);

    const grouped = groupAssignmentsByDepartment({
      assignments: [
        assignment("assignment-1", "employee-1"),
        assignment("assignment-2", "employee-2"),
      ],
      departments: [
        department("dept-1", "Creative"),
        department("dept-2", "Strategy"),
      ],
      employeeById,
      selectedDepartmentId: "dept-2",
    });

    expect([...grouped.keys()]).toEqual(["dept-2"]);
    expect(grouped.get("dept-2")?.assignments.map((item) => item.id)).toEqual([
      "assignment-2",
    ]);
  });

  it("ignores assignments whose employee department is not in the department list", () => {
    const employeeById = new Map([["employee-1", employee("employee-1", "dept-missing")]]);

    const grouped = groupAssignmentsByDepartment({
      assignments: [assignment("assignment-1", "employee-1")],
      departments: [department("dept-1", "Creative")],
      employeeById,
    });

    expect(grouped.get("dept-1")?.assignments).toEqual([]);
  });
});
