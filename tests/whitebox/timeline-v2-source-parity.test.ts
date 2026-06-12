import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("timeline-v2 source parity", () => {
  it("preserves page-level filters in HomeClient", () => {
    const source = readFileSync("app/HomeClient.tsx", "utf8");

    expect(source).toContain("<FilterBar");
    expect(source).toContain("Timeline");
    expect(source).not.toContain("components/timeline/Timeline");
    expect(source).toContain("searchQuery={searchQuery}");
    expect(source).toContain("onBrandChange={setSelectedBrandId}");
    expect(source).toContain("onDepartmentChange={setSelectedDepartment}");
    expect(source).toContain("onProjectChange={setFilterProjectId}");
  });

  it("keeps brand and project ids out of planner assignment request filters", () => {
    const source = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");

    expect(source).toContain("getVisibleEmployeeIds");
    expect(source).not.toContain("request.filters.brandId");
    expect(source).not.toContain("request.filters.projectId");
  });

  it("preserves required toolbar controls", () => {
    const source = readFileSync("components/timeline-v2/TimelineToolbar.tsx", "utf8");

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

  it("navigates periods through the view store without timers", () => {
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");
    const toolbarSource = readFileSync("components/timeline-v2/TimelineToolbar.tsx", "utf8");

    expect(toolbarSource).toContain("setAnchorDate(new Date())");
    expect(timelineSource).not.toContain("setTimeout(");
    expect(toolbarSource).not.toContain("setTimeout(");
  });

  it("groups expanded resource rows by campaigns instead of deliverables", () => {
    const source = readFileSync("lib/timeline-v2/row-model.ts", "utf8");

    expect(source).toContain("projectLanes");
    expect(source).toContain("getPlanCampaignProjects");
    expect(source).not.toContain("filterTimelineEmployees");
    expect(source).not.toContain("groupProjectsByDeliverable");
    expect(source).not.toContain("extractDeliverables");
  });

  it("renders expanded campaign groups as a single plan-only campaign lane", () => {
    const laneSource = readFileSync("components/timeline-v2/ProjectLane.tsx", "utf8");
    const rowSource = readFileSync("components/timeline-v2/ResourceRow.tsx", "utf8");

    expect(laneSource).toContain('data-testid="resource-row-v2-campaign-row"');
    expect(laneSource).toContain('data-testid="resource-row-v2-campaign-label"');
    expect(laneSource).toContain("{campaign.name}");
    expect(laneSource).not.toContain("CAMPAIGN_HEADER_ROW_HEIGHT");
    expect(laneSource).not.toContain("getCampaignHeaderHeight");
    expect(laneSource).not.toContain('data-testid="resource-row-v2-campaign-group"');
    expect(rowSource).toContain("TimelineExpandedSkeleton");
    expect(rowSource).not.toContain('<div data-testid="timeline-v2-expanded-loading" />');
  });

  it("positions bars by percentage with resolution-aware columns", () => {
    const laneSource = readFileSync("components/timeline-v2/ProjectLane.tsx", "utf8");
    const barSource = readFileSync("components/timeline-v2/AssignmentBar.tsx", "utf8");

    expect(laneSource).toContain('const monthRangeView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";');
    expect(laneSource).toContain('resolution={monthRangeView ? "month" : "day"}');
    expect(barSource).toContain("getTimelineAssignmentPosition");
    expect(barSource).toContain("leftPct");
    expect(barSource).toContain("widthPct");
    expect(barSource).not.toContain("cellWidth");
  });

  it("memoizes the hot row renderers", () => {
    const resourceRowSource = readFileSync("components/timeline-v2/ResourceRow.tsx", "utf8");
    const capacityStripSource = readFileSync("components/timeline-v2/CapacityStrip.tsx", "utf8");
    const laneSource = readFileSync("components/timeline-v2/ProjectLane.tsx", "utf8");
    const barSource = readFileSync("components/timeline-v2/AssignmentBar.tsx", "utf8");

    expect(resourceRowSource).toContain("React.memo");
    expect(capacityStripSource).toContain("React.memo");
    expect(laneSource).toContain("React.memo");
    expect(barSource).toContain("React.memo");
  });

  it("keeps the capacity strip display-only", () => {
    const capacityStripSource = readFileSync("components/timeline-v2/CapacityStrip.tsx", "utf8");
    const resourceRowSource = readFileSync("components/timeline-v2/ResourceRow.tsx", "utf8");

    expect(capacityStripSource).not.toContain("getAllocationCellModel");
    expect(capacityStripSource).not.toContain("assignments: Assignment[]");
    expect(capacityStripSource).not.toContain("actualAssignments: ActualAssignment[]");
    expect(capacityStripSource).toContain('cell.model.kind === "empty"');
    expect(resourceRowSource).toContain("cells={row.allocationCells}");
  });

  it("keeps bars click-isolated with single-row-only resize handles", () => {
    const barSource = readFileSync("components/timeline-v2/AssignmentBar.tsx", "utf8");

    expect(barSource).toContain("event.stopPropagation()");
    expect(barSource).not.toContain("data-resize-handle");
    expect(barSource).toContain("const canResize = canDrag && memberAssignments.length === 1;");
    expect(barSource).toContain("canResize ?");
  });

  it("styles dimensions through the token system, not magic pixel numbers", () => {
    const files = [
      "components/timeline-v2/Timeline.tsx",
      "components/timeline-v2/TimelineHeader.tsx",
      "components/timeline-v2/TimelineBody.tsx",
      "components/timeline-v2/ResourceRow.tsx",
      "components/timeline-v2/ProjectLane.tsx",
      "components/timeline-v2/CapacityStrip.tsx",
      "components/timeline-v2/ResourceIdentityCell.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} should not hardcode row heights`).not.toMatch(/height: ?(34|48|56)\b/);
      expect(source, `${file} should not use arbitrary height classes`).not.toContain("h-[34px]");
    }

    const rowSource = readFileSync("components/timeline-v2/ResourceRow.tsx", "utf8");
    const laneSource = readFileSync("components/timeline-v2/ProjectLane.tsx", "utf8");
    expect(rowSource).toContain("h-timeline-row");
    expect(laneSource).toContain("h-timeline-lane");
  });

  it("does not keep debug logs in v2 timeline files", () => {
    const files = [
      "components/timeline-v2/Timeline.tsx",
      "components/timeline-v2/ResourceRow.tsx",
      "components/timeline-v2/ProjectLane.tsx",
      "components/timeline-v2/AssignmentBar.tsx",
      "components/timeline-v2/useTimelineEditor.ts",
      "components/timeline-v2/editor/AssignmentEditor.tsx",
      "components/timeline-v2/editor/MonthDistributionFields.tsx",
      "lib/timeline-v2/assignment-write-service.ts",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("console.log");
      expect(source).not.toContain("console.debug");
    }
  });
});
