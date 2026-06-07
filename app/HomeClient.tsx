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
import { usePlannerHomeBootstrap } from "@/lib/query/hooks";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Department } from "@/lib/query/hooks/useDepartments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { getInitialPlannerRequest } from "@/lib/query/server/planner-startup";
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

function toBrandOption(brand: PlannerHomeBootstrapResponse["brandsById"][string]): Brand {
  return {
    id: brand.brandId,
    businessUnitId: null,
    name: brand.name,
    companyName: brand.companyName,
    brandAddress: null,
    clientCode: null,
    color: brand.color ?? "#64748b",
    logo: null,
    website: null,
    contactName: null,
    contactTitle: null,
    contactEmail: null,
    contactPhone: null,
    picFinanceName: null,
    picFinancePhone: null,
    industryCategory: null,
    description: null,
    status:
      brand.status === "active"
        ? "active"
        : brand.status === "inactive"
          ? "inactive"
          : "prospect",
    createdAt: brand.sourceUpdatedAt ?? brand.syncedAt,
    updatedAt: brand.sourceUpdatedAt ?? brand.syncedAt,
  };
}

function toDepartmentOption(
  department: PlannerHomeBootstrapResponse["departmentsById"][string]
): Department {
  return {
    id: department.departmentId,
    businessUnitId: null,
    name: department.name,
    code: department.code ?? "",
    color: department.color ?? "#64748b",
    description: null,
    isActive: department.isActive,
    createdAt: department.sourceUpdatedAt ?? department.syncedAt,
    updatedAt: department.sourceUpdatedAt ?? department.syncedAt,
  };
}

function toProjectOption(
  project: PlannerHomeBootstrapResponse["projectsById"][string]
): ProjectOption {
  return {
    id: project.sourceProjectId,
    name: project.name,
    color: project.color ?? "#64748b",
    status:
      project.status === "completed" ||
      project.status === "cancelled" ||
      project.status === "active" ||
      project.status === "planning" ||
      project.status === "on_hold"
        ? project.status
        : "planning",
    projectType: project.sourceType,
    brandId: project.brandId,
  };
}

export function HomeClient({
  initialTimelineAnchor,
  initialBootstrap,
  children,
}: HomeClientProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const bootstrapRequest = useMemo(
    () => ({
      ...getInitialPlannerRequest(initialTimelineAnchor),
      employeeLimit: 24,
      employeeOffset: 0,
      brandId: null,
      department: null,
      projectId: null,
      search: null,
    }),
    [initialTimelineAnchor]
  );

  const { data: plannerHomeBootstrap } = usePlannerHomeBootstrap(bootstrapRequest, {
    initialData: initialBootstrap ?? undefined,
    initialDataUpdatedAt: initialBootstrap
      ? Date.parse(initialBootstrap.freshness.directoryFetchedAt)
      : undefined,
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

  const bootstrapData = plannerHomeBootstrap ?? initialBootstrap ?? null;
  const brands = useMemo(
    () => Object.values(bootstrapData?.brandsById ?? {}).map(toBrandOption),
    [bootstrapData]
  );
  const departments = useMemo(
    () => Object.values(bootstrapData?.departmentsById ?? {}).map(toDepartmentOption),
    [bootstrapData]
  );
  const projects = useMemo(
    () => Object.values(bootstrapData?.projectsById ?? {}).map(toProjectOption),
    [bootstrapData]
  );

  return (
    <HomePlannerContext.Provider value={plannerFilters}>
      <div className="flex flex-col h-screen bg-background">
        <FilterBar
          brands={brands}
          departments={departments}
          projects={projects}
          selectedBrandId={selectedBrandId}
          onBrandChange={setSelectedBrandId}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={setSelectedDepartment}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenSetup={() => setIsSetupOpen(true)}
          projectId={filterProjectId}
          onProjectChange={setFilterProjectId}
        />

        <main className="flex-1 overflow-hidden">
          {children ?? (
            <HomePlannerTimeline
              initialTimelineAnchor={initialTimelineAnchor}
              initialBootstrap={initialBootstrap ?? undefined}
            />
          )}
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
