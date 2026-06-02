import type { ProjectOption } from "@/lib/query/hooks/useProjects";

export function mergeProjectsById({
  projects,
  selectedBrandProjects,
}: {
  projects: ProjectOption[];
  selectedBrandProjects: ProjectOption[];
}): ProjectOption[] {
  if (selectedBrandProjects.length === 0) {
    return projects;
  }

  const byId = new Map(projects.map((project) => [project.id, project]));
  for (const project of selectedBrandProjects) {
    byId.set(project.id, project);
  }

  return Array.from(byId.values());
}

export function getProjectIdSet(projects: ProjectOption[]): Set<string> {
  return new Set(projects.map((project) => project.id));
}

export function getProjectById(projects: ProjectOption[]): Map<string, ProjectOption> {
  return new Map(projects.map((project) => [project.id, project]));
}
