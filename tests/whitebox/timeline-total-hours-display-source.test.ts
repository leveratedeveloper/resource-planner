import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("timeline total-hours display source contract", () => {
  it("uses the display helper for assignment bar labels", () => {
    const source = readFileSync("components/timeline-v2/AssignmentBar.tsx", "utf8");

    expect(source).toContain("calculateAssignmentDisplayTotalHours");
    expect(source).toContain("formatAssignmentDisplayHours");
    expect(source).toContain("{displayTotalHoursLabel}");
    expect(source).not.toContain("assignment.totalHours");
  });
});
