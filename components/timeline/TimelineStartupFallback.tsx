import { eachMonthOfInterval, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function getQuarterMonths(initialTimelineAnchor: string) {
  const anchor = new Date(`${initialTimelineAnchor}T00:00:00`);
  const quarterStartMonth = Math.floor(anchor.getMonth() / 3) * 3;
  const quarterStart = new Date(anchor.getFullYear(), quarterStartMonth, 1);
  const quarterEnd = new Date(anchor.getFullYear(), quarterStartMonth + 2, 1);

  return eachMonthOfInterval({ start: quarterStart, end: quarterEnd });
}

export function TimelineStartupFallback({
  initialTimelineAnchor,
}: {
  initialTimelineAnchor: string;
}) {
  const months = getQuarterMonths(initialTimelineAnchor);

  return (
    <div className="flex h-full flex-col" data-testid="timeline-startup-fallback">
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex min-w-[240px] items-center gap-3">
            <div className="rounded-md border px-3 py-2 text-xs font-medium">Today</div>
            <Skeleton className="h-8 w-16" />
            <span className="text-sm font-medium">{format(months[0], "yyyy")}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
            <span className="px-3 py-1.5">Week</span>
            <span className="px-3 py-1.5">Month</span>
            <span className="rounded-md bg-background px-3 py-1.5 shadow-sm">Quarter</span>
            <span className="px-3 py-1.5">Half Year</span>
            <span className="px-3 py-1.5">Year</span>
          </div>
          <div className="w-[140px]" />
        </div>
      </div>

      <div className="flex border-b bg-muted/40">
        <div className="w-[250px] shrink-0 border-r bg-background p-4 font-semibold">
          Resources
        </div>
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
          {months.map((month) => (
            <div
              key={month.toISOString()}
              className="border-r bg-background p-4 text-center text-sm font-semibold"
            >
              {format(month, "MMMM")}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex border-b">
            <div className="sticky left-0 z-20 flex w-[250px] shrink-0 items-center gap-3 border-r bg-background p-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <div className="flex-1 px-2 py-4">
              <Skeleton className="h-full min-h-16 w-full opacity-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
