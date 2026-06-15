import { describe, expect, it } from "vitest";
import { getProjectDetailState } from "@/components/setup/project-setup/project-detail-state";
import type { Project } from "@/lib/query/hooks/useProjects";

function makePitch(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    brandId: "9",
    businessUnitId: null,
    projectCategoryId: null,
    projectTypeId: null,
    projectType: "pitch",
    entity: null,
    name: "BRI Pitch Media",
    projectNumber: null,
    description: null,
    color: "#64748b",
    budget: null,
    asf: null,
    grandTotal: null,
    currency: "IDR",
    ioFile: null,
    flag: null,
    quotationReference: null,
    startDate: null,
    endDate: null,
    status: "planning",
    createdById: null,
    notes: null,
    region: null,
    submitDate: null,
    pitchStatus: null,
    valueTotalEstimate: null,
    hsDealId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getProjectDetailState", () => {
  it("does not fabricate region/pitchStatus when the source value is null", () => {
    const state = getProjectDetailState(makePitch());
    expect(state.region).toBe("");
    expect(state.pitchStatus).toBe("");
  });

  it("preserves real region/pitchStatus values when present", () => {
    const state = getProjectDetailState(
      makePitch({ region: "Singapore", pitchStatus: "won" })
    );
    expect(state.region).toBe("Singapore");
    expect(state.pitchStatus).toBe("won");
  });
});
