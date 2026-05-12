export type IncrementalWindow<T> = {
  visibleItems: T[];
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
};

export function getIncrementalWindow<T>(
  items: readonly T[],
  pageSize: number,
  pageCount: number
): IncrementalWindow<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const safePageCount = Math.max(1, Math.floor(pageCount));
  const totalCount = items.length;
  const visibleCount = Math.min(totalCount, safePageSize * safePageCount);

  return {
    visibleItems: items.slice(0, visibleCount),
    visibleCount,
    totalCount,
    hasMore: visibleCount < totalCount,
  };
}
