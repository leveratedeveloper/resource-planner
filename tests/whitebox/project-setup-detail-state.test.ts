import { describe, expect, it } from "vitest";
import { getProjectDetailState } from "@/components/setup/project-setup/project-detail-state";
import type { Project } from "@/lib/query/hooks/useProjects";

describe("project setup detail state", () => {
  it("normalizes optional project fields for the modal state", () => {
    const project = {
      id: "project-1",
      brandId: "brand-1",
      businessUnitId: null,
      projectCategoryId: null,
      projectTypeId: null,
      projectType: "campaign",
      entity: null,
      name: "Launch",
      projectNumber: null,
      description: null,
      color: "#123456",
      budget: null,
      asf: null,
      grandTotal: null,
      currency: "USD",
      ioFile: null,
      flag: null,
      quotationReference: null,
      startDate: null,
      endDate: null,
      status: "active",
      createdById: null,
      notes: null,
      region: null,
      submitDate: null,
      pitchStatus: null,
      valueTotalEstimate: null,
      hsDealId: null,
      createdAt: "2026-05-01T00:00:00Z",
      updatedAt: "2026-05-01T00:00:00Z",
    } satisfies Project;

    const result = getProjectDetailState(project);
    expect(result).toMatchObject({
      projectType: "campaign",
      projectNumber: "",
      businessUnitId: "",
      projectCategoryId: "",
      budget: "",
      notes: "",
      region: "",
      pitchStatus: "",
    });
  });
});
