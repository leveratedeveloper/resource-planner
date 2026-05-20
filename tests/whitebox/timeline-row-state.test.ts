import { describe, expect, it } from "vitest";
import {
  getEmployeeFilterSelection,
  hasEmployeeFlag,
  setEmployeeFilterSelection,
  setEmployeeFlag,
} from "@/lib/timeline/row-state";

describe("timeline row state helpers", () => {
  it("persists expanded flags by employee id", () => {
    const expanded = setEmployeeFlag(new Set<string>(), "employee-1", true);
    const next = setEmployeeFlag(expanded, "employee-2", true);
    const collapsed = setEmployeeFlag(next, "employee-1", false);

    expect(hasEmployeeFlag(expanded, "employee-1")).toBe(true);
    expect(hasEmployeeFlag(next, "employee-2")).toBe(true);
    expect(hasEmployeeFlag(collapsed, "employee-1")).toBe(false);
    expect(hasEmployeeFlag(collapsed, "employee-2")).toBe(true);
  });

  it("persists project selections independently per employee", () => {
    const employeeOneSelection = new Set(["project-a", "project-b"]);
    const employeeTwoSelection = new Set(["project-c"]);

    const initial = setEmployeeFilterSelection(
      new Map<string, Set<string>>(),
      "employee-1",
      employeeOneSelection
    );
    const withSecondEmployee = setEmployeeFilterSelection(
      initial,
      "employee-2",
      employeeTwoSelection
    );

    expect(getEmployeeFilterSelection(withSecondEmployee, "employee-1")).toEqual(
      employeeOneSelection
    );
    expect(getEmployeeFilterSelection(withSecondEmployee, "employee-2")).toEqual(
      employeeTwoSelection
    );
    expect(getEmployeeFilterSelection(withSecondEmployee, "employee-missing")).toBeUndefined();
  });
});
