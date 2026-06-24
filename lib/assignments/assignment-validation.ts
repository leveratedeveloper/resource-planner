/** Thrown when an assignment write is rejected. The route maps this to HTTP 400. */
export class AssignmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssignmentValidationError";
  }
}

/** Validate an assignment write at the one write primitive.
 *  Assumes span dates are already coerced to strict "yyyy-MM-dd" (upsertAssignment
 *  coerces before calling this), so the lexicographic comparison is chronological.
 *  Rules: both span dates present, start <= end, at least one allocation, every hours
 *  value finite and >= 0 (zero is allowed — a blank-hours member is a valid 0h draft). */
export function validateAssignmentWrite(input: {
  span: { startDate: string; endDate: string };
  monthlyHours: Record<string, number>;
}): void {
  const { span, monthlyHours } = input;
  if (!span || !span.startDate || !span.endDate) {
    throw new AssignmentValidationError("Assignment span requires both a start and end date.");
  }
  if (span.startDate > span.endDate) {
    throw new AssignmentValidationError(
      `Assignment span is inverted (start ${span.startDate} is after end ${span.endDate}).`,
    );
  }
  const entries = Object.entries(monthlyHours);
  if (entries.length === 0) {
    throw new AssignmentValidationError("Assignment has no monthly allocations to write.");
  }
  for (const [month, hours] of entries) {
    if (!Number.isFinite(hours) || hours < 0) {
      throw new AssignmentValidationError(`Invalid hours for ${month}: must be a number ≥ 0 (got ${hours}).`);
    }
  }
}
