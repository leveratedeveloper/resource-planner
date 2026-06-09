import { addDays, endOfMonth, format, isAfter, isBefore, startOfDay, startOfMonth } from "date-fns";
import type { Assignment } from "@/lib/query/hooks/useAssignments";

export type TimelineV2PlanDisplaySegment = {
  id: string;
  sourceAssignment: Assignment;
  assignments: Assignment[];
  employeeId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  isAdjustment: boolean;
  category: Assignment["category"];
  status: Assignment["status"];
};

type TimelineV2DisplayResolution = "day" | "month";

function parseDate(value: string) {
  return startOfDay(new Date(`${value}T00:00:00`));
}

function formatSegmentDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getMergeKey(assignment: Assignment) {
  return [
    assignment.employeeId,
    assignment.projectId ?? "",
    assignment.isAdjustment ? "adjustment" : "plan",
    assignment.category ?? "",
    assignment.status ?? "",
  ].join("|");
}

type BuildTimelineV2PlanDisplaySegmentsInput =
  | Assignment[]
  | {
      assignments: Assignment[];
      visibleDates?: Date[];
      resolution?: TimelineV2DisplayResolution;
      projectStartDate?: string | null;
      projectEndDate?: string | null;
    };

function normalizeInput(input: BuildTimelineV2PlanDisplaySegmentsInput) {
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

function getColumnRange(date: Date, resolution: TimelineV2DisplayResolution) {
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

function getVisibleCoverage({
  assignment,
  visibleDates,
  resolution,
  projectStartDate,
  projectEndDate,
}: {
  assignment: Assignment;
  visibleDates: Date[];
  resolution: TimelineV2DisplayResolution;
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

export function buildTimelineV2PlanDisplaySegments(input: BuildTimelineV2PlanDisplaySegmentsInput): TimelineV2PlanDisplaySegment[] {
  const { assignments, visibleDates: inputVisibleDates, resolution, projectStartDate, projectEndDate } = normalizeInput(input);
  const plannedAssignments = assignments
    .filter((assignment) => !assignment.isTimeOff && assignment.projectId)
    .sort((a, b) => {
      const startDelta = parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime();
      if (startDelta !== 0) return startDelta;
      const endDelta = parseDate(a.endDate).getTime() - parseDate(b.endDate).getTime();
      if (endDelta !== 0) return endDelta;
      return a.id.localeCompare(b.id);
    });

  const segments: TimelineV2PlanDisplaySegment[] = [];
  const visibleDates = inputVisibleDates ?? buildDefaultVisibleDates(plannedAssignments);
  const lastSegmentByKey = new Map<
    string,
    {
      segment: TimelineV2PlanDisplaySegment;
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

    const segment: TimelineV2PlanDisplaySegment = {
      id: assignment.id,
      sourceAssignment: assignment,
      assignments: [assignment],
      employeeId: assignment.employeeId,
      projectId: assignment.projectId!,
      startDate: coverage.startDate,
      endDate: coverage.endDate,
      isAdjustment: assignment.isAdjustment,
      category: assignment.category,
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
