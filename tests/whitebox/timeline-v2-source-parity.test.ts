import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("timeline-v2 source parity", () => {
  it("preserves page-level filters in HomeClient", () => {
    const source = readFileSync("app/HomeClient.tsx", "utf8");

    expect(source).toContain("<FilterBar");
    expect(source).toContain("TimelineV2");
    expect(source).not.toContain("components/timeline/Timeline");
    expect(source).toContain("searchQuery={searchQuery}");
    expect(source).toContain("onBrandChange={setSelectedBrandId}");
    expect(source).toContain("onDepartmentChange={setSelectedDepartment}");
    expect(source).toContain("onProjectChange={setFilterProjectId}");
  });

  it("keeps brand and project ids out of planner assignment request filters", () => {
    const source = readFileSync("components/timeline-v2/TimelineV2.tsx", "utf8");

    expect(source).toContain("filterTimelineEmployees");
    expect(source).not.toContain("request.filters.brandId");
    expect(source).not.toContain("request.filters.projectId");
  });

  it("preserves required toolbar controls", () => {
    const source = readFileSync("components/timeline-v2/TimelineToolbarV2.tsx", "utf8");

    expect(source).toContain("timeline-v2-today-button");
    expect(source).toContain("timeline-v2-prev-button");
    expect(source).toContain("timeline-v2-next-button");
    expect(source).toContain('data-testid={`timeline-v2-view-${mode === "halfYear" ? "half-year" : mode}`}');
    expect(source).toContain('["week", "Week"]');
    expect(source).toContain('["month", "Month"]');
    expect(source).toContain('["quarter", "Quarter"]');
    expect(source).toContain('["halfYear", "Half Year"]');
    expect(source).toContain('["year", "Year"]');
    expect(source).toContain("timeline-v2-weekend-toggle");
  });

  it("groups expanded resource rows by campaigns instead of deliverables", () => {
    const source = readFileSync("lib/timeline-v2/row-model.ts", "utf8");

    expect(source).toContain("campaignGroups");
    expect(source).toContain("project.name");
    expect(source).toContain("getPlanCampaignProjects");
    expect(source).not.toContain("groupProjectsByDeliverable");
    expect(source).not.toContain("extractDeliverables");
  });

  it("renders expanded campaign groups as a single plan-only campaign lane", () => {
    const source = readFileSync("components/timeline-v2/ResourceRowV2.tsx", "utf8");

    expect(source).toContain('data-testid="resource-row-v2-campaign-row"');
    expect(source).not.toContain('data-testid="resource-row-v2-campaign-plan-row"');
    expect(source).not.toContain('data-testid="resource-row-v2-campaign-actual-row"');
    expect(source).not.toContain("group.row.actualAssignments.map");
  });

  it("does not keep debug logs in v2 timeline files", () => {
    const files = [
      "components/timeline-v2/TimelineV2.tsx",
      "components/timeline-v2/ResourceRowV2.tsx",
      "components/timeline-v2/AssignmentBlockV2.tsx",
      "components/timeline-v2/useTimelineV2Controller.ts",
      "lib/timeline-v2/monthly-allocation-service.ts",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("console.log");
      expect(source).not.toContain("console.debug");
    }
  });
});
