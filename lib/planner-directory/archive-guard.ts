/** True when a "mark missing as archived" sync saw ZERO ids and must be skipped.
 *  An empty seen-set almost always means a broken/empty upstream sync — running the
 *  archive anyway would issue an unfiltered UPDATE and archive the entire table,
 *  blanking the planner. Refuse it; a real "everything disappeared" is not a thing
 *  a single sync should ever conclude. */
export function shouldSkipArchive(seenIds: readonly string[]): boolean {
  return seenIds.length === 0;
}
