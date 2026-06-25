import { describe, it, expect } from "vitest";
import { validateAssignmentWrite, AssignmentValidationError } from "./assignment-validation";

describe("validateAssignmentWrite", () => {
  const okSpan = { startDate: "2026-04-01", endDate: "2026-06-30" };

  it("accepts a valid span with non-negative hours (zero allowed)", () => {
    expect(() =>
      validateAssignmentWrite({ span: okSpan, monthlyHours: { "2026-04-01": 10, "2026-05-01": 0 } }),
    ).not.toThrow();
  });

  it("throws when the span is missing a date", () => {
    expect(() =>
      validateAssignmentWrite({ span: { startDate: "2026-04-01", endDate: "" }, monthlyHours: { "2026-04-01": 1 } }),
    ).toThrow(AssignmentValidationError);
  });

  it("throws when the span is inverted", () => {
    expect(() =>
      validateAssignmentWrite({ span: { startDate: "2026-06-30", endDate: "2026-04-01" }, monthlyHours: { "2026-04-01": 1 } }),
    ).toThrow(/inverted/);
  });

  it("throws when there are no allocations (prevents orphan engagement headers)", () => {
    expect(() => validateAssignmentWrite({ span: okSpan, monthlyHours: {} })).toThrow(/no monthly allocations/);
  });

  it("throws on negative or non-finite hours", () => {
    expect(() => validateAssignmentWrite({ span: okSpan, monthlyHours: { "2026-04-01": -5 } })).toThrow(/Invalid hours/);
    expect(() => validateAssignmentWrite({ span: okSpan, monthlyHours: { "2026-04-01": NaN } })).toThrow(/Invalid hours/);
  });
});
