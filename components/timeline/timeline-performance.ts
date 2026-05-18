import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";

export const TIMELINE_ROW_BATCH_SIZE = 20;
export const TIMELINE_LOAD_MORE_THRESHOLD_PX = 400;

export interface TimelineRenderWindow {
  key: string;
  count: number;
}

export function getEffectiveRenderedRowCount(
  renderWindow: TimelineRenderWindow,
  renderWindowKey: string,
  batchSize = TIMELINE_ROW_BATCH_SIZE
) {
  return renderWindow.key === renderWindowKey ? renderWindow.count : batchSize;
}

export function getNextRenderedRowCount(
  currentCount: number,
  totalRows: number,
  batchSize = TIMELINE_ROW_BATCH_SIZE
) {
  if (currentCount >= totalRows) return currentCount;
  return Math.min(currentCount + batchSize, totalRows);
}

export function groupActualAssignmentsByEmployee(
  actualAssignments: ActualAssignment[]
) {
  const grouped = new Map<string, ActualAssignment[]>();
  actualAssignments.forEach((actual) => {
    if (!grouped.has(actual.employeeUuid)) {
      grouped.set(actual.employeeUuid, []);
    }
    grouped.get(actual.employeeUuid)!.push(actual);
  });
  return grouped;
}
