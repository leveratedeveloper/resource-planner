import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ProjectSetup source", () => {
  const source = readFileSync("components/setup/ProjectSetup.tsx", "utf8");

  it("imports cn because the project list and detail dialog use conditional classes", () => {
    expect(source).toContain('import { cn } from "@/lib/utils";');
    expect(source).toContain("className={cn(");
  });

  it("groups projects by brand with a memoized map", () => {
    expect(source).toContain("const projectsByBrand = useMemo(() =>");
    expect(source).toContain("const projectsByBrandId = new Map<string, Project[]>()");
    expect(source).not.toContain("projects: projects.filter((p) => p.brandId === brand.id)");
  });

  it("hides empty brands by default while keeping the empty-brand control explicit", () => {
    expect(source).toContain("const [showEmptyBrands, setShowEmptyBrands] = useState(false)");
    expect(source).toContain("if (!normalizedSearch) return showEmptyBrands || brandProjects.length > 0");
    expect(source).toContain('data-testid="toggle-empty-brands"');
  });

  it("defers expensive project detail data until a project detail modal is open", () => {
    expect(source).toContain("const isProjectDetailOpen = isDialogOpen && !!viewingProject");
    expect(source).toContain("useAssignments(undefined, { enabled: isProjectDetailOpen })");
    expect(source).toContain("useEmployees({ enabled: isProjectDetailOpen })");
    expect(source).toContain("enabled: isProjectDetailOpen");
  });

  it("exposes empty-brand visibility as an explicit user control", () => {
    expect(source).toContain("const [showEmptyBrands, setShowEmptyBrands] = useState(false)");
    expect(source).toContain("showEmptyBrands || brandProjects.length > 0");
    expect(source).toContain('data-testid="toggle-empty-brands"');
  });

  it("waits for brands before showing the no-brands empty state", () => {
    expect(source).toContain("isLoading: brandsLoading");
    expect(source).toContain("const isProjectListLoading = projectsLoading || brandsLoading");
    expect(source).toContain("projectsByBrand.length === 0 && !isProjectListLoading");
    expect(source).not.toContain("projectsByBrand.length === 0 && !projectsLoading");
  });
});
