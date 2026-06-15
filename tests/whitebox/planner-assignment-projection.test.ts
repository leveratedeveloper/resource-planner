import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner assignment projections", () => {
  it("uses timeline-specific selected columns for planner reads", () => {
    const queriesSource = readFileSync("lib/mysql-assignments/queries.ts", "utf8");
    const prefetchSource = readFileSync("lib/query/server/planner-prefetch.ts", "utf8");

    expect(queriesSource).toContain("const TIMELINE_ASSIGNMENT_COLUMNS");
    expect(queriesSource).toContain("getTimelineAssignments");
    expect(queriesSource).toContain("getTimelineActualAssignments");
    expect(prefetchSource).toContain("getTimelineAssignments");
    expect(prefetchSource).toContain("getTimelineActualAssignments");
    expect(prefetchSource).not.toContain("getAssignments({");
    expect(prefetchSource).not.toContain("getActualAssignments({");
  });
});
