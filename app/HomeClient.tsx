"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FilterBar } from "@/components/filters/FilterBar";
import { SetupManager } from "@/components/setup/SetupManager";
import { Timeline } from "@/components/timeline-v2";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useDepartments,
  usePlannerFilterBrands,
  usePlannerFilterProjects,
} from "@/lib/query/hooks";
import { XIcon } from "lucide-react";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import type { Brand } from "@/lib/query/hooks/useBrands";

interface HomeClientProps {
  initialTimelineAnchor: string;
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
}: {
  initialTimelineAnchor: string;
}) {
  const filters = useHomePlannerFilters();

  useEffect(() => {
    console.info("[Timing]", {
      flow: "planner_startup",
      phase: "timeline_shell_mount",
      durationMs: Math.round(performance.now()),
    });
  }, []);

  return (
    <Timeline
      initialTimelineAnchor={initialTimelineAnchor}
      brandId={filters.brandId}
      department={filters.department}
      searchQuery={filters.searchQuery}
      projectId={filters.projectId}
    />
  );
}

export function HomeClient({
  initialTimelineAnchor,
  children,
}: HomeClientProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  // The selected brand/project objects are stashed at selection time, not
  // derived by .find() over loaded pages — with server pagination a selection
  // made via search may not be in the currently-loaded page.
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [brandSearch, setBrandSearch] = useState("");
  const debouncedBrandSearch = useDebounce(brandSearch, 300);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [selectedProjectStatus, setSelectedProjectStatus] = useState<ProjectOption["status"] | null>(null);
  const [selectedProjectSourceType, setSelectedProjectSourceType] = useState<ProjectOption["projectType"] | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const debouncedProjectSearch = useDebounce(projectSearch, 300);
  const { data: departments = [] } = useDepartments();

  // Infinite filter catalogs: search and project scope (brand/status/type) are
  // server-side, so the dropdown payload stays bounded as the directory grows.
  const brandQuery = usePlannerFilterBrands({ search: debouncedBrandSearch });
  const projectQuery = usePlannerFilterProjects({
    brandId: selectedBrandId,
    status: selectedProjectStatus,
    sourceType: selectedProjectSourceType,
    search: debouncedProjectSearch,
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

  const brands = useMemo(
    () => brandQuery.data?.pages.flatMap((page) => page.brands) ?? [],
    [brandQuery.data]
  );
  const brandTotal = brandQuery.data?.pages[0]?.total ?? brands.length;
  const projects = useMemo(
    () => projectQuery.data?.pages.flatMap((page) => page.projects) ?? [],
    [projectQuery.data]
  );
  const projectTotal = projectQuery.data?.pages[0]?.total ?? projects.length;

  // Brand and project filters intersect on the client and the server scopes the
  // employee page by the selected project's brand. A project left selected from
  // a different brand intersects to an empty timeline and makes the server page
  // the wrong employees — clear it (and its dependent status/type) when the
  // brand changes to one the project doesn't belong to. Reads the stashed
  // selectedProject object, not a lookup over loaded pages.
  const handleBrandChange = useCallback(
    (brand: Brand | null) => {
      setSelectedBrand(brand);
      setSelectedBrandId(brand?.id ?? null);
      if (brand && selectedProject && selectedProject.brandId !== brand.id) {
        setSelectedProject(null);
        setFilterProjectId(null);
        setSelectedProjectStatus(null);
        setSelectedProjectSourceType(null);
      }
    },
    [selectedProject]
  );

  const handleProjectChange = useCallback((project: ProjectOption | null) => {
    setSelectedProject(project);
    setFilterProjectId(project?.id ?? null);
  }, []);

  return (
    <HomePlannerContext.Provider value={plannerFilters}>
      <div className="flex flex-col h-screen bg-background">
        <FilterBar
          brands={brands}
          selectedBrand={selectedBrand}
          departments={departments}
          projects={projects}
          selectedBrandId={selectedBrandId}
          onBrandChange={handleBrandChange}
          brandSearch={brandSearch}
          brandTotal={brandTotal}
          isLoadingBrands={brandQuery.isFetching && !brandQuery.isFetchingNextPage}
          brandHasMore={brandQuery.hasNextPage}
          isFetchingMoreBrands={brandQuery.isFetchingNextPage}
          onLoadMoreBrands={() => {
            if (brandQuery.hasNextPage && !brandQuery.isFetchingNextPage) brandQuery.fetchNextPage();
          }}
          onBrandSearchChange={setBrandSearch}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={setSelectedDepartment}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenSetup={() => setIsSetupOpen(true)}
          projectId={filterProjectId}
          onProjectChange={handleProjectChange}
          selectedProject={selectedProject}
          projectSearch={projectSearch}
          projectTotal={projectTotal}
          isLoadingProjects={projectQuery.isFetching && !projectQuery.isFetchingNextPage}
          projectHasMore={projectQuery.hasNextPage}
          isFetchingMoreProjects={projectQuery.isFetchingNextPage}
          onLoadMoreProjects={() => {
            if (projectQuery.hasNextPage && !projectQuery.isFetchingNextPage) projectQuery.fetchNextPage();
          }}
          projectScopeBrandName={selectedBrand?.name ?? null}
          selectedProjectStatus={selectedProjectStatus}
          selectedProjectSourceType={selectedProjectSourceType}
          onProjectStatusChange={setSelectedProjectStatus}
          onProjectSourceTypeChange={setSelectedProjectSourceType}
          onProjectSearchChange={setProjectSearch}
        />

        <main className="flex-1 overflow-hidden">
          {children ?? (
            <HomePlannerTimeline initialTimelineAnchor={initialTimelineAnchor} />
          )}
        </main>

        <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
          <DialogContent className="flex w-full h-[90vh] overflow-hidden p-0 gap-0" showCloseButton={false}>
            <div className="sr-only">
              <DialogTitle>Setup</DialogTitle>
              <DialogDescription>
                Manage your brands and team resources.
              </DialogDescription>
            </div>
            <DialogClose className="absolute right-4 top-4 z-[70] inline-flex size-10 items-center justify-center rounded-xl border-2 border-border/80 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <XIcon className="size-4" />
              <span className="sr-only">Close setup</span>
            </DialogClose>
            <SetupManager />
          </DialogContent>
        </Dialog>
      </div>
    </HomePlannerContext.Provider>
  );
}
