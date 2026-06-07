import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as employeeHooks from "@/lib/query/hooks/useEmployees";

describe("employee query hooks", () => {
  it("exports only implemented employee fetch hooks", () => {
    expect(employeeHooks).toHaveProperty("useEmployees");
    expect(employeeHooks).toHaveProperty("useInfiniteEmployees");
    expect(employeeHooks).not.toHaveProperty("useEmployee");
    expect(employeeHooks).not.toHaveProperty("useCreateEmployee");
    expect(employeeHooks).not.toHaveProperty("useUpdateEmployee");
    expect(employeeHooks).not.toHaveProperty("useDeleteEmployee");
  });

  it("allows infinite employee loading to start from a bootstrap page", () => {
    const source = readFileSync("lib/query/hooks/useEmployees.ts", "utf8");

    expect(source).toContain("initialPage?: PaginatedResponse<Employee> | null");
    expect(source).toContain("initialData: options?.initialPage");
    expect(source).toContain("pageParams: [0]");
    expect(source).toContain("allPages.reduce((acc, page) => acc + page.data.length, 0)");
  });
});
