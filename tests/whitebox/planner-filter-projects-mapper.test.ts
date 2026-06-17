import { describe, expect, it } from "vitest";
import { toProjectOption } from "@/lib/query/server/planner-filter-projects";
import type { PlannerDirectoryProjectRow } from "@/lib/planner-directory/types";

function buildRow(overrides: Partial<PlannerDirectoryProjectRow> = {}): PlannerDirectoryProjectRow {
  return {
    projectKey: "campaign:proj-1",
    sourceProjectId: "proj-1",
    sourceType: "campaign",
    name: "Spring Launch",
    brandId: "brand-1",
    brandName: "Acme",
    brandCompanyName: "Acme Inc",
    color: "#123456",
    status: "active",
    startDate: "2026-04-01",
    endDate: "2026-08-31",
    submitDate: null,
    sourceUpdatedAt: "2026-03-01T00:00:00.000Z",
    sourceHash: "hash-1",
    syncedAt: "2026-03-02T00:00:00.000Z",
    lastSeenAt: "2026-03-02T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("toProjectOption", () => {
  it("preserves the project's start and end dates", () => {
    const result = toProjectOption(buildRow());

    expect(result.startDate).toBe("2026-04-01");
    expect(result.endDate).toBe("2026-08-31");
  });

  it("maps null start and end dates to null", () => {
    const result = toProjectOption(buildRow({ startDate: null, endDate: null }));

    expect(result.startDate).toBeNull();
    expect(result.endDate).toBeNull();
  });
});
