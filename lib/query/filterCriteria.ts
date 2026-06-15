import type { ProjectOption } from "@/lib/query/hooks/useProjects";

/**
 * Single definition of "does the user have active brand input?".
 * Used by the brand hook's `enabled` gate and by HomeClient's display gate so
 * the fetch decision and the show-results decision can never disagree.
 */
export function hasBrandCriteria(search: string): boolean {
  return search.trim().length > 0;
}

export type ProjectCriteria = {
  search: string;
  brandId: string | null;
  status: ProjectOption["status"] | null;
  sourceType: ProjectOption["projectType"] | null;
};

/**
 * Single definition of "does the user have active project input?". A scoped
 * brand / status / type counts as input even with no typing. Keyed on the brand
 * `id` (never the name) so the hook and the UI agree on the same fact.
 */
export function hasProjectCriteria(criteria: ProjectCriteria): boolean {
  return (
    criteria.search.trim().length > 0 ||
    !!criteria.brandId ||
    !!criteria.status ||
    !!criteria.sourceType
  );
}
