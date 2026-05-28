import { describe, expect, it } from "vitest";
import {
  extractDeliverables,
  getMonthlyDetailKey,
  parseHoursSafe,
} from "@/lib/timeline/resource-row-model";

describe("resource-row-model", () => {
  it("extracts deliverables from note", () => {
    expect(
      extractDeliverables("Scope updated. Deliverables: KV, Banner, Landing Page.")
    ).toEqual(["KV", "Banner", "Landing Page"]);
  });

  it("returns empty deliverables when marker is missing", () => {
    expect(extractDeliverables("No deliverable marker")).toEqual([]);
    expect(extractDeliverables(null)).toEqual([]);
  });

  it("builds stable monthly detail key", () => {
    const key = getMonthlyDetailKey(
      "emp-1",
      "proj-1",
      new Date("2026-05-01T00:00:00Z"),
      new Date("2026-05-31T00:00:00Z")
    );
    expect(key).toBe("emp-1:proj-1:2026-05-01:2026-05-31");
  });

  it("parses hour values safely", () => {
    expect(parseHoursSafe("1.5")).toBe(1.5);
    expect(parseHoursSafe("2,5")).toBe(2.5);
    expect(parseHoursSafe(3)).toBe(3);
    expect(parseHoursSafe(null)).toBe(0);
    expect(parseHoursSafe("abc")).toBe(0);
  });
});
