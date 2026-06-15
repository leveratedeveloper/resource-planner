import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner benchmark script", () => {
  it("measures planner endpoint latency and payload size", () => {
    const source = readFileSync("scripts/benchmark-planner-timeline.ts", "utf8");

    expect(source).toContain("planner/home-bootstrap");
    expect(source).toContain("planner/timeline");
    expect(source).toContain("performance.now");
    expect(source).toContain("Buffer.byteLength");
  });
});
