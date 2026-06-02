import { describe, expect, it } from "vitest";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  getProjectById,
  getProjectIdSet,
  mergeProjectsById,
} from "@/lib/timeline/project-index";

const makeProject = (overrides: Partial<ProjectOption>): ProjectOption => ({
  id: "project-1",
  name: "Project 1",
  color: "#2563eb",
  status: "active",
  projectType: "campaign",
  brandId: "brand-1",
  ...overrides,
});

describe("timeline project index helpers", () => {
  it("merges selected brand projects into the base project list by id", () => {
    const merged = mergeProjectsById({
      projects: [
        makeProject({ id: "project-a", name: "A", brandId: "brand-a" }),
        makeProject({ id: "project-b", name: "Old B", brandId: "brand-b" }),
      ],
      selectedBrandProjects: [
        makeProject({ id: "project-b", name: "New B", brandId: "brand-b" }),
        makeProject({ id: "project-c", name: "C", brandId: "brand-b" }),
      ],
    });

    expect(merged.map((project) => [project.id, project.name])).toEqual([
      ["project-a", "A"],
      ["project-b", "New B"],
      ["project-c", "C"],
    ]);
  });

  it("builds stable project id sets and lookup maps", () => {
    const projects = [
      makeProject({ id: "project-a", brandId: "brand-a" }),
      makeProject({ id: "project-b", brandId: "brand-b" }),
    ];

    expect(getProjectIdSet(projects)).toEqual(new Set(["project-a", "project-b"]));
    expect(getProjectById(projects).get("project-b")?.brandId).toBe("brand-b");
  });
});
