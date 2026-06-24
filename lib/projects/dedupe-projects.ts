import type { Project } from "@/lib/query/hooks/useProjects";

/**
 * Collapse a flattened infinite-query project list to one entry per `id`,
 * keeping the first occurrence and preserving order. Guards the rendered
 * `key={project.id}` list against duplicate keys if a project ever appears on
 * two pages (e.g. boundary instability) or two source rows share an id.
 */
export function dedupeProjectsById(projects: Project[]): Project[] {
  const seen = new Set<string>();
  const result: Project[] = [];
  for (const project of projects) {
    if (seen.has(project.id)) continue;
    seen.add(project.id);
    result.push(project);
  }
  return result;
}
