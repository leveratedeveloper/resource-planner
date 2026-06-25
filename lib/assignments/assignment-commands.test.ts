import { describe, it, expect } from "vitest";
import { buildAllocationRows } from "./assignment-commands";

describe("buildAllocationRows", () => {
  it("maps monthlyHours into sorted (month, plannedHours, kind) rows", () => {
    expect(buildAllocationRows({ "2026-05-01": 20, "2026-04-01": 10 }, "plan")).toEqual([
      { month: "2026-04-01", plannedHours: 10, kind: "plan" },
      { month: "2026-05-01", plannedHours: 20, kind: "plan" },
    ]);
  });
});
