import type { ResourceCapacityAnalysis } from "@/lib/analysis/types";

export type UtilizationBandId =
  | "available-capacity"
  | "below-target"
  | "healthy-load"
  | "over-capacity";

export type UtilizationSignalBand = {
  id: UtilizationBandId;
  label: string;
  description: string;
  icon: string;
  colorClassName: string;
  surfaceClassName: string;
  accentClassName: string;
  iconSurfaceClassName: string;
};

export type UtilizationSignal = UtilizationSignalBand & {
  count: number;
  totalCount: number;
  percentage: number;
  delta?: number;
  deltaLabel?: string;
};

export const UTILIZATION_SIGNAL_BANDS: UtilizationSignalBand[] = [
  {
    id: "available-capacity",
    label: "Available capacity",
    description: "Less than 60% utilized",
    icon: "lucide:circle",
    colorClassName: "text-amber-600 dark:text-amber-400",
    surfaceClassName: "bg-amber-50/90 dark:bg-amber-950/30",
    accentClassName: "border-l-amber-500",
    iconSurfaceClassName: "bg-amber-100 dark:bg-amber-900/50",
  },
  {
    id: "below-target",
    label: "Below target",
    description: "60-79% utilized",
    icon: "lucide:trending-up",
    colorClassName: "text-sky-600 dark:text-sky-400",
    surfaceClassName: "bg-sky-50/90 dark:bg-sky-950/30",
    accentClassName: "border-l-sky-500",
    iconSurfaceClassName: "bg-sky-100 dark:bg-sky-900/50",
  },
  {
    id: "healthy-load",
    label: "Healthy load",
    description: "80-90% utilized",
    icon: "lucide:check-circle-2",
    colorClassName: "text-emerald-600 dark:text-emerald-400",
    surfaceClassName: "bg-emerald-50/90 dark:bg-emerald-950/30",
    accentClassName: "border-l-emerald-500",
    iconSurfaceClassName: "bg-emerald-100 dark:bg-emerald-900/50",
  },
  {
    id: "over-capacity",
    label: "Over capacity",
    description: "More than 90% utilized",
    icon: "lucide:alert-triangle",
    colorClassName: "text-destructive",
    surfaceClassName: "bg-red-50/90 dark:bg-red-950/30",
    accentClassName: "border-l-red-500",
    iconSurfaceClassName: "bg-red-100 dark:bg-red-900/50",
  },
];

export function getUtilizationBand(utilization: number): UtilizationBandId {
  if (utilization < 60) return "available-capacity";
  if (utilization < 80) return "below-target";
  if (utilization <= 90) return "healthy-load";
  return "over-capacity";
}

function countByBand(capacityAnalysis: readonly ResourceCapacityAnalysis[]) {
  const counts = new Map<UtilizationBandId, number>(
    UTILIZATION_SIGNAL_BANDS.map((band) => [band.id, 0])
  );

  for (const resource of capacityAnalysis) {
    const bandId = getUtilizationBand(resource.averageUtilization);
    counts.set(bandId, (counts.get(bandId) ?? 0) + 1);
  }

  return counts;
}

function getPercentage(count: number, totalCount: number) {
  if (totalCount === 0) return 0;
  return Math.round((count / totalCount) * 100);
}

function formatDelta(delta: number) {
  if (delta === 0) return "No change";
  return `${delta > 0 ? "+" : ""}${delta} pts vs previous`;
}

export function buildUtilizationSignals({
  current,
  previous,
}: {
  current: readonly ResourceCapacityAnalysis[];
  previous?: readonly ResourceCapacityAnalysis[] | null;
}): UtilizationSignal[] {
  const currentCounts = countByBand(current);
  const previousCounts = previous ? countByBand(previous) : null;
  const currentTotal = current.length;
  const previousTotal = previous?.length ?? 0;

  return UTILIZATION_SIGNAL_BANDS.map((band) => {
    const count = currentCounts.get(band.id) ?? 0;
    const percentage = getPercentage(count, currentTotal);
    const previousPercentage = previousCounts
      ? getPercentage(previousCounts.get(band.id) ?? 0, previousTotal)
      : null;
    const delta = previousPercentage === null ? undefined : percentage - previousPercentage;

    return {
      ...band,
      count,
      totalCount: currentTotal,
      percentage,
      delta,
      deltaLabel: delta === undefined ? undefined : formatDelta(delta),
    };
  });
}
