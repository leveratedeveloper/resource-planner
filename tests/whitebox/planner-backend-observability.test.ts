import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner backend observability", () => {
  it("logs planner fetch phases and response payload size", () => {
    const routeSource = readFileSync("app/api/planner/timeline/route.ts", "utf8");
    const prefetchSource = readFileSync("lib/query/server/planner-prefetch.ts", "utf8");

    expect(routeSource).toContain('createRequestTiming("planner_timeline_api")');
    expect(routeSource).toContain('timing.phase("response_payload"');
    expect(routeSource).toContain("Buffer.byteLength");
    expect(prefetchSource).toContain('timing.phase("planned_assignments_query"');
    expect(prefetchSource).not.toContain('timing.phase("actual_assignments_query"');
    expect(prefetchSource).toContain('timing.phase("monthly_summary"');
  });
});
