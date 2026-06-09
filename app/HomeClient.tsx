"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FilterBar } from "@/components/filters/FilterBar";
import { SetupManager } from "@/components/setup/SetupManager";
import { TimelineV2 } from "@/components/timeline-v2";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useDepartments,
  useInfinitePlannerFilterProjects,
  usePlannerFilterBrands,
} from "@/lib/query/hooks";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import type { PlannerHomeBootstrapResponse } from "@/lib/query/server/planner-home-bootstrap";

interface HomeClientProps {
  initialTimelineAnchor: string;
  initialBootstrap?: PlannerHomeBootstrapResponse | null;
  children?: ReactNode;
}

type HomePlannerFilters = {
  brandId: string | null;
  department: string | null;
  searchQuery: string;
  projectId: string | null;
};

const HomePlannerContext = createContext<HomePlannerFilters | null>(null);

function useHomePlannerFilters() {
  const filters = useContext(HomePlannerContext);
  if (!filters) {
    throw new Error("Home planner timeline must render inside HomeClient");
  }

  return filters;
}

export function HomePlannerTimeline({
  initialTimelineAnchor,
  initialBootstrap,
}: {
  initialTimelineAnchor: string;
  initialBootstrap?: PlannerHomeBootstrapResponse | null;
}) {
  const filters = useHomePlannerFilters();

  useEffect(() => {
    console.info("[Timing]", {
      flow: "planner_startup",
      phase: "critical_ready",
      durationMs: Math.round(performance.now()),
    });
  }, []);

  return (
    <TimelineV2
      initialTimelineAnchor={initialTimelineAnchor}
      initialBootstrap={initialBootstrap ?? undefined}
      brandId={filters.brandId}
      department={filters.department}
      searchQuery={filters.searchQuery}
      projectId={filters.projectId}
    />
  );
}

export function HomeClient({
  children,
}: HomeClientProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [selectedProjectStatus, setSelectedProjectStatus] = useState<ProjectOption["status"] | null>(null);
  const [selectedProjectSourceType, setSelectedProjectSourceType] = useState<ProjectOption["projectType"] | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const debouncedProjectSearch = useDebounce(projectSearch, 250);
  const { data: departments = [] } = useDepartments();
  const projectLimit = 100;

  const {
    data: brandOptions,
    isFetching: isFetchingBrandOptions,
  } = usePlannerFilterBrands({
    selectedBrandId,
  });

  const {
    data: projectOptionsPages,
    fetchNextPage: fetchNextProjectPage,
    hasNextPage: hasNextProjectPage,
    isFetching: isFetchingFilterOptions,
    isFetchingNextPage: isFetchingNextProjectPage,
  } = useInfinitePlannerFilterProjects({
    limit: projectLimit,
    brandId: selectedBrandId,
    status: selectedProjectStatus,
    sourceType: selectedProjectSourceType,
    search: debouncedProjectSearch.trim() || null,
    selectedProjectId: filterProjectId,
  });

  useEffect(() => {
    console.info("[Timing]", {
      flow: "planner_startup",
      phase: "shell_mount",
      durationMs: Math.round(performance.now()),
    });
  }, []);

  const plannerFilters = useMemo(
    () => ({
      brandId: selectedBrandId,
      department: selectedDepartment,
      searchQuery: debouncedSearch,
      projectId: filterProjectId,
    }),
    [debouncedSearch, filterProjectId, selectedBrandId, selectedDepartment]
  );

  const brands = useMemo(() => {
    const byId = new Map(
      brandOptions?.brands.map((brand) => [brand.id, brand])
    );

    return Array.from(byId.values());
  }, [brandOptions?.brands]);
  const selectedBrand = brandOptions?.selectedBrand ?? null;
  const brandTotal = Math.max(
    brandOptions?.total ?? 0,
    brands.length + (selectedBrand && !brands.some((brand) => brand.id === selectedBrand.id) ? 1 : 0)
  );
  const projects = useMemo(() => {
    const projectsById = new Map(
      projectOptionsPages?.pages
        .flatMap((page) => page.projects)
        .map((project) => [project.id, project])
    );

    return Array.from(projectsById.values());
  }, [projectOptionsPages?.pages]);
  const selectedProject = projectOptionsPages?.pages[0]?.selectedProject ?? null;
  const projectScope = projectOptionsPages?.pages[0]?.scope ?? null;
  const projectTotal = Math.max(
    projectOptionsPages?.pages.at(-1)?.total ?? 0,
    projects.length + (selectedProject && !projects.some((project) => project.id === selectedProject.id) ? 1 : 0)
  );

  const handleLoadMoreProjects = () => {
    if (!hasNextProjectPage || isFetchingNextProjectPage) return;
    fetchNextProjectPage();
  };

  return (
    <HomePlannerContext.Provider value={plannerFilters}>
      <div className="flex flex-col h-screen bg-background">
        <FilterBar
          brands={brands}
          selectedBrand={selectedBrand}
          departments={departments}
          projects={projects}
          selectedBrandId={selectedBrandId}
          onBrandChange={setSelectedBrandId}
          brandSearch={brandSearch}
          brandTotal={brandTotal}
          isLoadingBrands={isFetchingBrandOptions}
          onBrandSearchChange={setBrandSearch}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={setSelectedDepartment}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenSetup={() => setIsSetupOpen(true)}
          projectId={filterProjectId}
          onProjectChange={setFilterProjectId}
          selectedProject={selectedProject}
          projectSearch={projectSearch}
          projectTotal={projectTotal}
          projectHasMore={hasNextProjectPage ?? false}
          isLoadingProjects={isFetchingFilterOptions}
          projectScopeBrandName={projectScope?.brandName ?? selectedBrand?.name ?? null}
          selectedProjectStatus={selectedProjectStatus}
          selectedProjectSourceType={selectedProjectSourceType}
          onProjectStatusChange={setSelectedProjectStatus}
          onProjectSourceTypeChange={setSelectedProjectSourceType}
          onProjectSearchChange={setProjectSearch}
          onLoadMoreProjects={handleLoadMoreProjects}
        />

        <main className="flex-1 overflow-hidden">{children}</main>

        <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
          <DialogContent className="w-full h-[90vh] overflow-y-auto">
            <div className="sr-only">
              <DialogTitle>Setup</DialogTitle>
              <DialogDescription>
                Manage your brands and team resources.
              </DialogDescription>
            </div>
            <SetupManager />
          </DialogContent>
        </Dialog>
      </div>
    </HomePlannerContext.Provider>
  );
}
