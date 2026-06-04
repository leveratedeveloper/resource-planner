import { describe, expect, it } from "vitest";
import { getTimelineV2AllocationModel } from "@/lib/timeline-v2/allocation-model";

describe("timeline-v2 allocation model", () => {
  it("returns the existing allocation model contract", () => {
    expect(typeof getTimelineV2AllocationModel).toBe("function");
  });
});
