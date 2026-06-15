import { beforeEach, describe, expect, it } from "vitest";
import { useTimelineExpansionStore } from "@/lib/timeline-v2/expansion-store";

describe("timeline v2 expansion store", () => {
  beforeEach(() => {
    useTimelineExpansionStore.setState({ expandedIds: new Set() });
  });

  it("toggle adds an id, then removes it on the second call", () => {
    const { toggle } = useTimelineExpansionStore.getState();

    toggle("row-1");
    expect(useTimelineExpansionStore.getState().expandedIds.has("row-1")).toBe(true);

    toggle("row-1");
    expect(useTimelineExpansionStore.getState().expandedIds.has("row-1")).toBe(false);
  });

  it("toggling one id leaves other expanded ids intact", () => {
    const { toggle } = useTimelineExpansionStore.getState();

    toggle("row-1");
    toggle("row-2");
    toggle("row-1");

    const { expandedIds } = useTimelineExpansionStore.getState();
    expect(expandedIds.has("row-1")).toBe(false);
    expect(expandedIds.has("row-2")).toBe(true);
    expect(expandedIds.size).toBe(1);
  });

  it("collapseAll empties the set", () => {
    const { toggle, collapseAll } = useTimelineExpansionStore.getState();

    toggle("row-1");
    toggle("row-2");
    collapseAll();

    expect(useTimelineExpansionStore.getState().expandedIds.size).toBe(0);
  });

  it("collapseAll on an already-empty set keeps the same Set reference", () => {
    const before = useTimelineExpansionStore.getState().expandedIds;
    expect(before.size).toBe(0);

    useTimelineExpansionStore.getState().collapseAll();

    expect(useTimelineExpansionStore.getState().expandedIds).toBe(before);
  });

  it("each mutation produces a new Set reference", () => {
    const initial = useTimelineExpansionStore.getState().expandedIds;

    useTimelineExpansionStore.getState().toggle("row-1");
    const afterAdd = useTimelineExpansionStore.getState().expandedIds;
    expect(afterAdd).not.toBe(initial);

    useTimelineExpansionStore.getState().toggle("row-1");
    const afterRemove = useTimelineExpansionStore.getState().expandedIds;
    expect(afterRemove).not.toBe(afterAdd);

    useTimelineExpansionStore.getState().toggle("row-2");
    const beforeCollapse = useTimelineExpansionStore.getState().expandedIds;
    useTimelineExpansionStore.getState().collapseAll();
    const afterCollapse = useTimelineExpansionStore.getState().expandedIds;
    expect(afterCollapse).not.toBe(beforeCollapse);
    expect(afterCollapse.size).toBe(0);
  });
});
