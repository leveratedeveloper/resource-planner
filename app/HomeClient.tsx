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
import { Timeline } from "@/components/timeline/Timeline";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";

interface HomeClientProps {
  initialTimelineAnchor: string;
  children?: ReactNode;
}

type HomePlannerFilters = {
  brandId: string | null;
  department: string | null;
  searchQuery: string;
  projectId: string | null;
  category: string | null;
  status: string | null;
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
      phase: "critical_ready",
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
      category={filters.category}
      status={filters.status}
    />
  );
}

export function HomeClient({
  initialTimelineAnchor,
  children,
}: HomeClientProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

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
      category: filterCategory,
      status: filterStatus,
    }),
    [
      debouncedSearch,
      filterCategory,
      filterProjectId,
      filterStatus,
      selectedBrandId,
      selectedDepartment,
    ]
  );

  return (
    <HomePlannerContext.Provider value={plannerFilters}>
      <div className="flex flex-col h-screen bg-background">
        <FilterBar
          selectedBrandId={selectedBrandId}
          onBrandChange={setSelectedBrandId}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={setSelectedDepartment}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenSetup={() => setIsSetupOpen(true)}
          projectId={filterProjectId}
          onProjectChange={setFilterProjectId}
          category={filterCategory}
          onCategoryChange={setFilterCategory}
          status={filterStatus}
          onStatusChange={setFilterStatus}
        />

        <main className="flex-1 overflow-hidden">
          {children ?? <HomePlannerTimeline initialTimelineAnchor={initialTimelineAnchor} />}
        </main>

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
