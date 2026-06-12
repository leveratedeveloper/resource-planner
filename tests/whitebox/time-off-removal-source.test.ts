import { readFileSync } from "fs";

describe("time-off feature removal source guards", () => {
  it("does not expose time-off creation or lane UI in timeline v2", () => {
    const timeline = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");
    const body = readFileSync("components/timeline-v2/TimelineBody.tsx", "utf8");
    const resourceRow = readFileSync("components/timeline-v2/ResourceRow.tsx", "utf8");
    const editorHook = readFileSync("components/timeline-v2/useTimelineEditor.ts", "utf8");

    expect(timeline).not.toContain("onOpenTimeOffCreate");
    expect(body).not.toContain("onOpenTimeOffCreate");
    expect(resourceRow).not.toContain("Time Off");
    expect(resourceRow).not.toContain("isTimeOffMode");
    expect(resourceRow).not.toContain("resource-row-v2-timeoff-row");
    expect(editorHook).not.toContain("handleCreateTimeOff");
    expect(editorHook).not.toContain("isTimeOff: true");
  });

  it("does not expose time-off blocking or allocation display logic", () => {
    const dragToCreate = readFileSync("components/timeline-v2/interactions/useDragToCreate.ts", "utf8");
    const allocationModel = readFileSync("lib/timeline-v2/allocation-model.ts", "utf8");
    const dayMap = readFileSync("lib/timeline-v2/allocation-day-map.ts", "utf8");
    const distributor = readFileSync("lib/utils/allocation-distributor.ts", "utf8");

    expect(dragToCreate).not.toContain("timeOffAssignments");
    expect(dragToCreate).not.toContain("Cannot schedule - Time Off");
    expect(allocationModel).not.toContain("kind: \"time-off\"");
    expect(dayMap).not.toContain("timeOffAssignments");
    expect(distributor).not.toContain("timeOffAssignments");
    expect(distributor).not.toContain("blockedDays.timeOff");
  });

  it("does not expose time-off API create or update affordances", () => {
    const assignmentsRoute = readFileSync("app/api/assignments/route.ts", "utf8");
    const assignmentRoute = readFileSync("app/api/assignments/[id]/route.ts", "utf8");
    const actualRoute = readFileSync("app/api/actual/route.ts", "utf8");
    const actualItemRoute = readFileSync("app/api/actual/[uuid]/route.ts", "utf8");

    expect(assignmentsRoute).not.toContain("isCreatingOwnTimeOff");
    expect(assignmentRoute).not.toContain("isUpdatingOwnTimeOff");
    expect(assignmentRoute).not.toContain("isDeletingOwnTimeOff");
    expect(actualRoute).toContain("Time-off actual assignments are retired");
    expect(actualItemRoute).toContain("Time-off actual assignments are retired");
  });
});
