import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("home backend cleanup", () => {
  it("removes dead code and high-volume debug logs from home loading paths", () => {
    const dbSource = readFileSync("lib/mysql-assignments/db.ts", "utf8");
    const queriesSource = readFileSync("lib/mysql-assignments/queries.ts", "utf8");
    const controllerSource = readFileSync("components/timeline-v2/useTimelineV2Controller.ts", "utf8");
    const brandsRouteSource = readFileSync("app/api/brands/route.ts", "utf8");
    const brandsHookSource = readFileSync("lib/query/hooks/useBrands.ts", "utf8");

    expect(dbSource).not.toContain("PostgreSQLClient");
    expect(queriesSource).not.toContain("validateAssignmentData");
    expect(queriesSource).not.toContain("[createAssignment] Input");
    expect(controllerSource).not.toContain("openMonthlyAllocationConfirm");
    expect(brandsRouteSource).not.toContain("JSON.stringify(response, null, 2)");
    expect(brandsHookSource).not.toContain("[fetchBrandsPaginated]");
  });
});
