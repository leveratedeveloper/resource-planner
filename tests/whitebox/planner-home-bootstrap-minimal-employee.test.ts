import { describe, expect, it } from "vitest";
import { toMinimalEmployee } from "@/lib/query/server/planner-home-bootstrap";
import type { PlannerDirectoryEmployeeRow } from "@/lib/planner-directory/types";

const makeRow = (overrides: Partial<PlannerDirectoryEmployeeRow> = {}): PlannerDirectoryEmployeeRow => ({
  employeeUuid: "uuid-1",
  sourceEmployeeId: "FR-071",
  employeeNumber: "FR-071",
  nik: "FR-071",
  fullName: "Carina Hartanto",
  nickname: null,
  email: null,
  photo: null,
  position: "Designer",
  departmentId: "7",
  weeklyCapacity: 40,
  employmentStatus: "active",
  visibility: "active",
  workStartDate: null,
  sourceUpdatedAt: null,
  sourceHash: "",
  syncedAt: "",
  lastSeenAt: "",
  archivedAt: null,
  ...overrides,
});

describe("toMinimalEmployee", () => {
  it("carries sourceEmployeeId and employmentStatus into the timeline payload", () => {
    const minimal = toMinimalEmployee(makeRow(), {});
    expect(minimal.sourceEmployeeId).toBe("FR-071");
    expect(minimal.employmentStatus).toBe("active");
  });

  it("preserves a null sourceEmployeeId", () => {
    const minimal = toMinimalEmployee(makeRow({ sourceEmployeeId: null }), {});
    expect(minimal.sourceEmployeeId).toBeNull();
  });
});
