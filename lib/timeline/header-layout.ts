export function getTimelineHeaderLayout({
  columnCount,
  cellWidth,
}: {
  columnCount: number;
  cellWidth: number;
}) {
  return {
    headerWidth: `${columnCount * cellWidth}px`,
    columnWidth: `${cellWidth}px`,
  };
}
