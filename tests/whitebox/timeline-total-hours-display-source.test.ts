import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("timeline total-hours display source contract", () => {
  it("uses hoursPerDay display helper in assignment bars", () => {
    const source = readFileSync("components/timeline-v2/AssignmentBar.tsx", "utf8");

    expect(source).toContain("calculateAssignmentDisplayTotalHours");
    expect(source).toContain("formatAssignmentDisplayHours");
    expect(source).toContain("{displayTotalHoursLabel}");
    expect(source).not.toContain("assignment.totalHours");
  });

  it("uses hoursPerDay display helper for V2 monthly modal totals", () => {
    const source = readFileSync("components/timeline-v2/ProjectLane.tsx", "utf8");

    expect(source).toContain("calculateAssignmentDisplayTotalHours");
    expect(source).toContain("const range = { startDate: monthStart, endDate: monthEnd };");
    expect(source).toContain("return sum + calculateAssignmentDisplayTotalHours(assignment, range);");
    expect(source).not.toContain('Number.parseFloat(assignment.hoursPerDay || "0") * countWeekdays');
    expect(source).not.toContain("assignment.totalHours");
  });
});
