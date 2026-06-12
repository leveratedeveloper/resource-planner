import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEmployeeScopeClause } from "@/lib/mysql-assignments/queries";

// Contract for the bootstrap's employee-scoped timeline queries: the page's
// uuid list bounds the payload to rendered employees (DESIGN spec 2026-06-12).
describe("timeline query employee scoping", () => {
  it("adds no clause without employee filters", () => {
    expect(buildEmployeeScopeClause({})).toEqual({ sql: "", params: [] });
    expect(buildEmployeeScopeClause({ employee_uuids: [] })).toEqual({ sql: "", params: [] });
  });

  it("keeps the restricted-user single-uuid filter", () => {
    expect(buildEmployeeScopeClause({ employee_uuid: "emp-1" })).toEqual({
      sql: " AND employee_uuid = ?",
      params: ["emp-1"],
    });
  });

  it("emits an IN clause with one placeholder per uuid, params in order", () => {
    expect(buildEmployeeScopeClause({ employee_uuids: ["a", "b", "c"] })).toEqual({
      sql: " AND employee_uuid IN (?,?,?)",
      params: ["a", "b", "c"],
    });
    expect(buildEmployeeScopeClause({ employee_uuids: ["only"] })).toEqual({
      sql: " AND employee_uuid IN (?)",
      params: ["only"],
    });
  });

  it("lets the uuid list supersede the single-uuid filter", () => {
    expect(
      buildEmployeeScopeClause({ employee_uuid: "restricted", employee_uuids: ["a", "b"] })
    ).toEqual({
      sql: " AND employee_uuid IN (?,?)",
      params: ["a", "b"],
    });
  });
});

describe("bootstrap employee page scoping", () => {
  // Because the uuid list supersedes the single-uuid filter (above), restricted
  // users must never have a caller-supplied list forwarded to the query layer.
  it("keeps restricted users scoped to their own uuid at the query layer", () => {
    const prefetchSource = readFileSync("lib/query/server/planner-prefetch.ts", "utf8");

    expect(
      prefetchSource.match(
        /employee_uuids: session\.access\.can_view_all \? employeeUuids : undefined/g
      )?.length
    ).toBe(2);
  });

  // Bootstrap pages are the timeline's only employee source; department must
  // narrow the page server-side or filtered views reveal members progressively
  // page by page instead of completely.
  it("filters the employee page by department on the server", () => {
    const repositorySource = readFileSync("lib/planner-directory/repository.ts", "utf8");
    const bootstrapSource = readFileSync("lib/query/server/planner-home-bootstrap.ts", "utf8");

    expect(repositorySource).toContain("e.department_id = ${dialect");
    expect(bootstrapSource).toContain("department: session.access.can_view_all");
  });
});
