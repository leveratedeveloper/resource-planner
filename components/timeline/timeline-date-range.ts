import { endOfMonth } from "date-fns";
import { toLocalDateString } from "@/lib/utils";
import type { ViewMode } from "./TimelineHeaderControls";

export function getTimelineDateRange(days: Date[], viewMode: ViewMode) {
  if (days.length === 0) return undefined;

  const start = days[0];
  const lastDay = days[days.length - 1];
  const end =
    viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year"
      ? endOfMonth(lastDay)
      : lastDay;

  return {
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
  };
}
