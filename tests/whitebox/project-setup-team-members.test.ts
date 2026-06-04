import { describe, expect, it } from "vitest";
import { buildEmployeeAssignmentMap, buildProjectTeamMembers } from "@/components/setup/project-setup/team-members";

describe("project setup team member helpers", () => {
  const employees = [
    {
      id: "emp-1",
      fullName: "Ada Lovelace",
      position: "Engineer",
      department: { name: "Tech" },
    },
    {
      id: "emp-2",
      fullName: "Grace Hopper",
      position: "Producer",
      department: null,
    },
  ];

  const allAssignments = [
    {
      employeeId: "emp-1",
      startDate: "2026-05-04",
      endDate: "2026-05-08",
      hoursPerDay: "4",
      isTimeOff: false,
    },
    {
      employeeId: "emp-1",
      startDate: "2026-05-11",
      endDate: "2026-05-15",
      hoursPerDay: "8",
      isTimeOff: false,
    },
  ];

  it("groups assignments by employee", () => {
    const map = buildEmployeeAssignmentMap(employees, allAssignments);
    expect(map.get("emp-1")?.allAssignments).toHaveLength(2);
    expect(map.get("emp-2")?.allAssignments).toHaveLength(0);
  });

  it("builds team members from existing and pending assignments", () => {
    const map = buildEmployeeAssignmentMap(employees, allAssignments);
    const teamMembers = buildProjectTeamMembers({
      employeeMap: map,
      projectAssignments: [{ employeeId: "emp-1" }],
      pendingAssignments: [{ employeeId: "emp-2" }],
      dateRange: { from: new Date("2026-05-01"), to: new Date("2026-05-31") },
    });

    expect(teamMembers).toHaveLength(2);
    expect(teamMembers[0]).toMatchObject({ id: "emp-1", fullName: "Ada Lovelace" });
    expect(teamMembers[1]).toMatchObject({ id: "emp-2", fullName: "Grace Hopper" });
    expect(teamMembers[0].allocationPercentage).toContain("36%");
    expect(teamMembers[1].allocationPercentage).toContain("0%");
  });

  it("formats monthly allocation percentages for a bounded date range", () => {
    const employeeMap = buildEmployeeAssignmentMap(
      [
        {
          id: "employee-1",
          fullName: "Ada Lovelace",
          position: "Developer",
          department: { name: "Engineering" },
        },
      ],
      [
        {
          employeeId: "employee-1",
          startDate: "2026-01-05",
          endDate: "2026-01-09",
          hoursPerDay: "8",
          isTimeOff: false,
        },
      ]
    );

    const result = buildProjectTeamMembers({
      employeeMap,
      projectAssignments: [{ employeeId: "employee-1" }],
      pendingAssignments: [],
      dateRange: {
        from: new Date("2026-01-01T00:00:00"),
        to: new Date("2026-01-31T00:00:00"),
      },
    });

    expect(result[0].allocationPercentage).toEqual(["23%"]);
  });
});
