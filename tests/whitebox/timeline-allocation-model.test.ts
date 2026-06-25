import { describe, it, expect } from "vitest";
import { getAllocationCellModel } from "@/lib/timeline-v2/allocation-model";
import { toLocalDateString } from "@/lib/utils";

describe("getAllocationCellModel — hours surfaced for display", () => {
  it("returns plan hours and an h-suffixed label alongside the percentage (single-day cell)", () => {
    const day = new Date(2026, 5, 15);
    const dayMap = new Map([[toLocalDateString(day), { planHours: 6, actualHours: 0 }]]);

    const model = getAllocationCellModel({ dayMap, day, viewMode: "month", capacity: 40 });

    expect(model.kind).toBe("allocation");
    if (model.kind !== "allocation") return;
    expect(model.planHours).toBe(6);
    expect(model.planHoursLabel).toBe("6h");
    expect(model.planLabel).toBe("75%");
  });

  it("rounds fractional hours to one decimal in the label", () => {
    const day = new Date(2026, 5, 15);
    const dayMap = new Map([[toLocalDateString(day), { planHours: 7.5, actualHours: 0 }]]);

    const model = getAllocationCellModel({ dayMap, day, viewMode: "month", capacity: 40 });

    expect(model.kind).toBe("allocation");
    if (model.kind !== "allocation") return;
    expect(model.planHours).toBe(7.5);
    expect(model.planHoursLabel).toBe("7.5h");
  });
});
