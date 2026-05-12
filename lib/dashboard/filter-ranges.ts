import { toLocalDateKey } from "@/lib/analysis/date-utils";

export type DashboardTimePreset = "weekly" | "monthly" | "annual" | "custom";

export type DashboardDateRange = {
  startDate: string;
  endDate: string;
};

type DashboardDateRangeOptions = {
  today?: Date;
  customStartDate?: Date | null;
  customEndDate?: Date | null;
};

type CustomDateRangeInput = {
  startDate?: Date | null;
  endDate?: Date | null;
  today?: Date;
};

const PRESET_LABELS: Record<DashboardTimePreset, string> = {
  weekly: "Last 7 days",
  monthly: "Last 1 month",
  annual: "Last 1 year",
  custom: "Custom range",
};

function normalizeDate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function subtractRollingPeriod(today: Date, preset: Exclude<DashboardTimePreset, "custom">) {
  const start = normalizeDate(today);

  if (preset === "weekly") {
    start.setDate(start.getDate() - 7);
    return start;
  }

  if (preset === "monthly") {
    start.setMonth(start.getMonth() - 1);
    return start;
  }

  start.setFullYear(start.getFullYear() - 1);
  return start;
}

export function isValidCustomDateRange({ startDate, endDate, today = new Date() }: CustomDateRangeInput) {
  if (!startDate || !endDate) return false;
  const normalizedStart = normalizeDate(startDate).getTime();
  const normalizedEnd = normalizeDate(endDate).getTime();
  const normalizedToday = normalizeDate(today).getTime();
  return normalizedStart <= normalizedEnd && normalizedEnd <= normalizedToday;
}

export function getDashboardDateRange(
  preset: DashboardTimePreset,
  options: DashboardDateRangeOptions = {}
): DashboardDateRange {
  const today = normalizeDate(options.today ?? new Date());
  const endDate = today;

  if (
    preset === "custom" &&
    isValidCustomDateRange({
      startDate: options.customStartDate,
      endDate: options.customEndDate,
      today,
    })
  ) {
    return {
      startDate: toLocalDateKey(normalizeDate(options.customStartDate as Date)),
      endDate: toLocalDateKey(normalizeDate(options.customEndDate as Date)),
    };
  }

  const startDate =
    preset === "custom" ? subtractRollingPeriod(today, "monthly") : subtractRollingPeriod(today, preset);

  return {
    startDate: toLocalDateKey(startDate),
    endDate: toLocalDateKey(endDate),
  };
}

export function getDashboardTimePresetLabel(preset: DashboardTimePreset) {
  return PRESET_LABELS[preset];
}

export function getDashboardScopeLabel({
  preset,
  range,
  departmentName,
}: {
  preset: DashboardTimePreset;
  range: DashboardDateRange;
  departmentName?: string | null;
}) {
  const timeLabel =
    preset === "custom" ? `${range.startDate} to ${range.endDate}` : getDashboardTimePresetLabel(preset);
  return `${timeLabel} · ${departmentName || "All departments"}`;
}
