export function getTimelineHeaderLayout({
  columnCount,
  cellWidth,
  criticalStartupPending,
}: {
  columnCount: number;
  cellWidth: number;
  criticalStartupPending: boolean;
}) {
  if (criticalStartupPending && columnCount > 0) {
    return {
      headerWidth: "100%",
      columnWidth: `${100 / columnCount}%`,
    };
  }

  return {
    headerWidth: `${columnCount * cellWidth}px`,
    columnWidth: `${cellWidth}px`,
  };
}
