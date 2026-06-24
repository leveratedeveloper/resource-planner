import { addDays, endOfMonth, format, isAfter, isBefore, startOfDay, startOfMonth } from "date-fns";
import type { Assignment } from "@/lib/query/hooks/useAssignments";

export type TimelinePlanDisplaySegment = {
  id: string;
  sourceAssignment: Assignment;
  assignments: Assignment[];
  employeeId: string;
  projectKey: string;
  startDate: string;
  endDate: string;
  status: Assignment["status"];
};

type TimelineDisplayResolution = "day" | "month";

function parseDate(value: string) {
  return startOfDay(new Date(`${value}T00:00:00`));
}

function formatSegmentDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getMergeKey(assignment: Assignment) {
  return [
    assignment.employeeId,
    assignment.projectKey ?? "",
    assignment.status ?? "",
  ].join("|");
}

type BuildTimelinePlanDisplaySegmentsInput =
  | Assignment[]
  | {
      assignments: Assignment[];
      visibleDates?: Date[];
      resolution?: TimelineDisplayResolution;
      projectStartDate?: string | null;
      projectEndDate?: string | null;
    };

function normalizeInput(input: BuildTimelinePlanDisplaySegmentsInput) {
  if (Array.isArray(input)) {
    return {
      assignments: input,
      visibleDates: undefined,
      resolution: "day" as const,
      projectStartDate: null,
      projectEndDate: null,
    };
  }

  return {
    resolution: "day" as const,
    ...input,
  };
}

function buildDefaultVisibleDates(assignments: Assignment[]) {
  if (assignments.length === 0) return [];

  const starts = assignments.map((assignment) => parseDate(assignment.startDate).getTime());
  const ends = assignments.map((assignment) => parseDate(assignment.endDate).getTime());
  let cursor = startOfDay(new Date(Math.min(...starts)));
  const end = startOfDay(new Date(Math.max(...ends)));
  const dates: Date[] = [];

  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function getColumnRange(date: Date, resolution: TimelineDisplayResolution) {
  if (resolution === "month") {
    return {
      start: startOfMonth(date),
      end: endOfMonth(date),
    };
  }

  return {
    start: startOfDay(date),
    end: startOfDay(date),
  };
}

function overlapsRange(start: Date, end: Date, rangeStart: Date, rangeEnd: Date) {
  return start <= rangeEnd && end >= rangeStart;
}

/**
 * An assignment is "visible" if it has at least one allocation month with hours
 * AND its date span overlaps the visible column range.
 */
function hasHours(assignment: Assignment): boolean {
  return assignment.allocations.some((alloc) => alloc.plannedHours > 0);
}

function getVisibleCoverage({
  assignment,
  visibleDates,
  resolution,
  projectStartDate,
  projectEndDate,
}: {
  assignment: Assignment;
  visibleDates: Date[];
  resolution: TimelineDisplayResolution;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
}) {
  let start = parseDate(assignment.startDate);
  let end = parseDate(assignment.endDate);

  if (projectStartDate) {
    const projectStart = parseDate(projectStartDate);
    if (isAfter(projectStart, start)) start = projectStart;
  }

  if (projectEndDate) {
    const projectEnd = parseDate(projectEndDate);
    if (isBefore(projectEnd, end)) end = projectEnd;
  }

  if (isAfter(start, end)) return null;

  let startIndex = -1;
  let endIndex = -1;

  visibleDates.forEach((date, index) => {
    const columnRange = getColumnRange(date, resolution);
    if (!overlapsRange(start, end, columnRange.start, columnRange.end)) return;
    if (startIndex === -1) startIndex = index;
    endIndex = index;
  });

  if (startIndex === -1 || endIndex === -1) return null;

  return {
    startIndex,
    endIndex,
    startDate: formatSegmentDate(visibleDates[startIndex]),
    endDate: formatSegmentDate(visibleDates[endIndex]),
  };
}

export function buildTimelinePlanDisplaySegments(input: BuildTimelinePlanDisplaySegmentsInput): TimelinePlanDisplaySegment[] {
  const { assignments, visibleDates: inputVisibleDates, resolution, projectStartDate, projectEndDate } = normalizeInput(input);
  const plannedAssignments = assignments
    .filter((assignment) => assignment.projectKey && hasHours(assignment))
    .sort((a, b) => {
      const startDelta = parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime();
      if (startDelta !== 0) return startDelta;
      const endDelta = parseDate(a.endDate).getTime() - parseDate(b.endDate).getTime();
      if (endDelta !== 0) return endDelta;
      return a.id.localeCompare(b.id);
    });

  const segments: TimelinePlanDisplaySegment[] = [];
  const visibleDates = inputVisibleDates ?? buildDefaultVisibleDates(plannedAssignments);
  const lastSegmentByKey = new Map<
    string,
    {
      segment: TimelinePlanDisplaySegment;
      endIndex: number;
    }
  >();

  for (const assignment of plannedAssignments) {
    const mergeKey = getMergeKey(assignment);
    const lastSegment = lastSegmentByKey.get(mergeKey);
    const coverage = getVisibleCoverage({
      assignment,
      visibleDates,
      resolution,
      projectStartDate,
      projectEndDate,
    });

    if (!coverage) continue;

    if (lastSegment && coverage.startIndex <= lastSegment.endIndex + 1) {
      lastSegment.segment.assignments.push(assignment);
      if (coverage.endIndex > lastSegment.endIndex) {
        lastSegment.segment.endDate = coverage.endDate;
      }
      lastSegment.endIndex = Math.max(lastSegment.endIndex, coverage.endIndex);
      continue;
    }

    const segment: TimelinePlanDisplaySegment = {
      id: assignment.id,
      sourceAssignment: assignment,
      assignments: [assignment],
      employeeId: assignment.employeeId,
      projectKey: assignment.projectKey,
      startDate: coverage.startDate,
      endDate: coverage.endDate,
      status: assignment.status,
    };

    segments.push(segment);
    lastSegmentByKey.set(mergeKey, {
      segment,
      endIndex: coverage.endIndex,
    });
  }

  return segments;
}
