import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("timeline query indexes", () => {
  it("adds targeted indexes for date-overlap planner reads", () => {
    const source = readFileSync("migrations/add_timeline_query_indexes.sql", "utf8");

    expect(source).toContain("idx_assignments_timeline_overlap");
    expect(source).toContain("idx_actual_timeline_overlap");
    expect(source).toContain("employee_uuid");
    expect(source).toContain("end_date");
    expect(source).toContain("start_date");
    expect(source).toContain("status");
    expect(source).toContain("category");
  });
});
