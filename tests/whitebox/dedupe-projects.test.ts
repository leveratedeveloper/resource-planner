import { describe, expect, it } from "vitest";
import { dedupeProjectsById } from "@/lib/projects/dedupe-projects";
import type { Project } from "@/lib/query/hooks/useProjects";

function makeProject(id: string, name: string): Project {
  return { id, name } as unknown as Project;
}

describe("dedupeProjectsById", () => {
  it("removes later duplicates while keeping first occurrence and order", () => {
    const input = [
      makeProject("a", "Alpha"),
      makeProject("b", "Beta"),
      makeProject("a", "Alpha (dupe from next page)"),
      makeProject("c", "Gamma"),
    ];

    const result = dedupeProjectsById(input);

    expect(result.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(result[0].name).toBe("Alpha");
  });

  it("returns an empty array unchanged", () => {
    expect(dedupeProjectsById([])).toEqual([]);
  });

  it("leaves an already-unique list intact", () => {
    const input = [makeProject("a", "Alpha"), makeProject("b", "Beta")];
    expect(dedupeProjectsById(input).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
