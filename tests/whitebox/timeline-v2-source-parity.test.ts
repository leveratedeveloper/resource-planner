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

  it("uses a deterministic Today scroll helper and no timeout", () => {
    const source = readFileSync("components/timeline-v2/TimelineV2.tsx", "utf8");

    expect(source).toContain("getTimelineV2TodayScrollLeft");
    expect(source).not.toContain("setTimeout(");
  });

  it("groups expanded resource rows by campaigns instead of deliverables", () => {
    const source = readFileSync("lib/timeline-v2/row-model.ts", "utf8");

    expect(source).toContain("campaignGroups");
    expect(source).toContain("project.name");
    expect(source).toContain("getPlanCampaignProjects");
    expect(source).not.toContain("filterTimelineEmployees");
    expect(source).not.toContain("groupProjectsByDeliverable");
    expect(source).not.toContain("extractDeliverables");
  });

  it("renders expanded campaign groups as a single plan-only campaign lane", () => {
    const source = readFileSync("components/timeline-v2/ResourceRowV2.tsx", "utf8");

    expect(source).toContain('data-testid="resource-row-v2-campaign-row"');
    expect(source).toContain('data-testid="resource-row-v2-campaign-label"');
    expect(source).toContain("{campaign.name}");
    expect(source).not.toContain("CAMPAIGN_HEADER_ROW_HEIGHT");
    expect(source).not.toContain("getCampaignHeaderHeight");
    expect(source).not.toContain('data-testid="resource-row-v2-campaign-group"');
    expect(source).toContain("TimelineExpandedSkeletonV2");
    expect(source).not.toContain('<div data-testid="timeline-v2-expanded-loading" />');
  });

  it("uses the correct week-mode check in ResourceRowV2", () => {
    const source = readFileSync("components/timeline-v2/ResourceRowV2.tsx", "utf8");

    expect(source).toContain('isWeekView={viewMode === "week"}');
  });

  it("memoizes the hot row renderers", () => {
    const resourceRowSource = readFileSync("components/timeline-v2/ResourceRowV2.tsx", "utf8");
    const allocationCellSource = readFileSync("components/timeline-v2/AllocationCellV2.tsx", "utf8");

    expect(resourceRowSource).toContain("React.memo");
    expect(allocationCellSource).toContain("React.memo");
  });

  it("keeps allocation cell rendering display-only", () => {
    const allocationCellSource = readFileSync("components/timeline-v2/AllocationCellV2.tsx", "utf8");
    const resourceRowSource = readFileSync("components/timeline-v2/ResourceRowV2.tsx", "utf8");

    expect(allocationCellSource).not.toContain("getTimelineV2AllocationModel");
    expect(allocationCellSource).not.toContain("assignments: Assignment[]");
    expect(allocationCellSource).not.toContain("actualAssignments: ActualAssignment[]");
    expect(allocationCellSource).toContain("allocationCell: TimelineV2AllocationCell");
    expect(resourceRowSource).toContain("row.allocationCells[index]");
  });

  it("handles missing prepared allocation cells explicitly", () => {
    const resourceRowSource = readFileSync("components/timeline-v2/ResourceRowV2.tsx", "utf8");

    expect(resourceRowSource).toContain("fallbackAllocationCell");
    expect(resourceRowSource).toContain('kind: "empty"');
  });

  it("keeps v2 assignment blocks non-resizable and click-isolated", () => {
    const assignmentBlockV2Source = readFileSync("components/timeline-v2/AssignmentBlockV2.tsx", "utf8");
    const assignmentBlockSource = readFileSync("components/timeline/AssignmentBlock.tsx", "utf8");

    expect(assignmentBlockV2Source).toContain("resizable = false");
    expect(assignmentBlockV2Source).toContain("resizable={resizable}");
    expect(assignmentBlockSource).toContain("resizable = true");
    expect(assignmentBlockSource).toContain("if (!resizable) return;");
    expect(assignmentBlockSource).toContain("e.stopPropagation();");
    expect(assignmentBlockSource).toContain("setIsTooltipOpen(false);");
    expect(assignmentBlockSource).toContain("!disabled && resizable");
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
