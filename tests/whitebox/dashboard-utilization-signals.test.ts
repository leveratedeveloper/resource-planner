import { describe, expect, it } from "vitest";
import {
  buildUtilizationSignals,
  getUtilizationBand,
} from "@/lib/dashboard/utilization-signals";
import type { ResourceCapacityAnalysis } from "@/lib/analysis/types";

function makeResource(
  resourceId: string,
  averageUtilization: number
): ResourceCapacityAnalysis {
  return {
    resourceId,
    resourceName: resourceId,
    department: "Operations",
    role: "Planner",
    weeklyCapacity: 40,
    dailyUtilization: [],
    averageUtilization,
    peakUtilization: averageUtilization,
    overallocatedDays: 0,
    underutilizedDays: 0,
    billablePercent: 0,
    status:
      averageUtilization > 100
        ? "overallocated"
        : averageUtilization < 60
          ? "underutilized"
          : "optimal",
  };
}

describe("dashboard utilization signals", () => {
  it("classifies utilization by the executive signal thresholds", () => {
    expect(getUtilizationBand(59.9)).toBe("available-capacity");
    expect(getUtilizationBand(60)).toBe("below-target");
    expect(getUtilizationBand(79.9)).toBe("below-target");
    expect(getUtilizationBand(80)).toBe("healthy-load");
    expect(getUtilizationBand(90)).toBe("healthy-load");
    expect(getUtilizationBand(90.1)).toBe("over-capacity");
  });

  it("returns employee counts and percentages for each band", () => {
    const signals = buildUtilizationSignals({
      current: [
        makeResource("emp-1", 20),
        makeResource("emp-2", 65),
        makeResource("emp-3", 84),
        makeResource("emp-4", 96),
      ],
    });

    expect(signals.map((signal) => signal.count)).toEqual([1, 1, 1, 1]);
    expect(signals.map((signal) => signal.percentage)).toEqual([25, 25, 25, 25]);
    expect(signals.every((signal) => signal.totalCount === 4)).toBe(true);
  });

  it("keeps all percentages at zero when no employees are in scope", () => {
    const signals = buildUtilizationSignals({ current: [] });

    expect(signals.map((signal) => signal.count)).toEqual([0, 0, 0, 0]);
    expect(signals.map((signal) => signal.percentage)).toEqual([0, 0, 0, 0]);
    expect(signals.every((signal) => signal.totalCount === 0)).toBe(true);
  });

  it("returns stable zero deltas when current and previous scopes are empty", () => {
    const signals = buildUtilizationSignals({ current: [], previous: [] });

    expect(signals.map((signal) => signal.delta)).toEqual([0, 0, 0, 0]);
    expect(signals.map((signal) => signal.deltaLabel)).toEqual([
      "No change",
      "No change",
      "No change",
      "No change",
    ]);
  });

  it("adds percentage-point deltas when previous-period analysis is supplied", () => {
    const signals = buildUtilizationSignals({
      current: [
        makeResource("emp-1", 20),
        makeResource("emp-2", 20),
        makeResource("emp-3", 84),
        makeResource("emp-4", 96),
      ],
      previous: [
        makeResource("emp-1", 65),
        makeResource("emp-2", 84),
        makeResource("emp-3", 84),
        makeResource("emp-4", 96),
      ],
    });

    expect(signals.map((signal) => signal.delta)).toEqual([50, -25, -25, 0]);
    expect(signals.map((signal) => signal.deltaLabel)).toEqual([
      "+50 pts vs previous",
      "-25 pts vs previous",
      "-25 pts vs previous",
      "No change",
    ]);
  });
});
