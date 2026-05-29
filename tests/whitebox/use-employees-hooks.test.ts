import { describe, expect, it } from "vitest";
import * as employeeHooks from "@/lib/query/hooks/useEmployees";

describe("employee hook exports", () => {
  it("exports only implemented employee fetch hooks", () => {
    expect(employeeHooks).toHaveProperty("useEmployees");
    expect(employeeHooks).toHaveProperty("useInfiniteEmployees");
    expect(employeeHooks).not.toHaveProperty("useEmployee");
    expect(employeeHooks).not.toHaveProperty("useCreateEmployee");
    expect(employeeHooks).not.toHaveProperty("useUpdateEmployee");
    expect(employeeHooks).not.toHaveProperty("useDeleteEmployee");
  });
});
