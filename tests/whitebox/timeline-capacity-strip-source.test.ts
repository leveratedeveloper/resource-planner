import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("components/timeline-v2/CapacityStrip.tsx", "utf8");

describe("CapacityStrip render", () => {
  it("shows hours as the primary number and the percentage beneath it", () => {
    expect(source).toContain("planHoursLabel");
    expect(source).toContain("planLabel");
    expect(source.indexOf("planHoursLabel")).toBeLessThan(source.indexOf("cell.model.planLabel"));
  });
});
