import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("timeline total-hours display source contract", () => {
  it("uses hoursPerDay display helper in planned assignment blocks", () => {
    const source = readFileSync("components/timeline/AssignmentBlock.tsx", "utf8");

    expect(source).toContain("calculateAssignmentDisplayTotalHours");
    expect(source).toContain("formatAssignmentDisplayHours");
    expect(source).toContain("const displayRange = { startDate: days[0] ?? startDate, endDate: days[days.length - 1] ?? endDate };");
    expect(source).toContain("const displayTotalHours = calculateAssignmentDisplayTotalHours(assignment, displayRange);");
    expect(source).toContain("{displayTotalHoursLabel}");
    expect(source).not.toContain('<div className=\"truncate opacity-90\">{hoursPerDay}h/day</div>');
    expect(source).not.toContain("assignment.totalHours");
  });

  it("uses hoursPerDay display helper in actual assignment blocks", () => {
    const source = readFileSync("components/timeline/ActualAssignmentBlock.tsx", "utf8");

    expect(source).toContain("calculateAssignmentDisplayTotalHours");
    expect(source).toContain("formatAssignmentDisplayHours");
    expect(source).toContain("const displayRange = { startDate: days[0] ?? startDate, endDate: days[days.length - 1] ?? endDate };");
    expect(source).toContain("const displayTotalHours = calculateAssignmentDisplayTotalHours(assignment, displayRange);");
    expect(source).toContain("{displayTotalHoursLabel}");
    expect(source).not.toContain('<div className=\"truncate opacity-90\">{hoursPerDay}h/day</div>');
    expect(source).not.toContain("assignment.totalHours");
  });

  it("uses hoursPerDay display helper for V2 monthly modal totals", () => {
    const source = readFileSync("components/timeline-v2/ResourceRowV2.tsx", "utf8");

    expect(source).toContain("calculateAssignmentDisplayTotalHours");
    expect(source).toContain("const range = { startDate: monthStart, endDate: monthEnd };");
    expect(source).toContain("return sum + calculateAssignmentDisplayTotalHours(assignment, range);");
    expect(source).not.toContain('Number.parseFloat(assignment.hoursPerDay || "0") * countWeekdays');
    expect(source).not.toContain("assignment.totalHours");
  });
});
