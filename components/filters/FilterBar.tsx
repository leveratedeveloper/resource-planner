"use client";

import React from "react";
import Link from "next/link";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Department } from "@/lib/query/hooks/useDepartments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { useAuth } from "@/context/AuthContext";
import { canAccessDashboard, isFullAccess } from "@/lib/auth/client-access";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportButton } from "@/components/export";
import { BrandFilterCombobox } from "@/components/filters/BrandFilterCombobox";
import { ProjectFilterCombobox } from "@/components/filters/ProjectFilterCombobox";

// Dashboard/Insights is still under development and not ready for production.
// Set this to `true` to re-enable the home-page entry point once it ships.
const DASHBOARD_FEATURE_ENABLED = false;

interface FilterBarProps {
  brands: Brand[];
  selectedBrand: Brand | null;
  departments: Department[];
  projects: ProjectOption[];
  selectedBrandId: string | null;
  onBrandChange: (brand: Brand | null) => void;
  brandSearch: string;
  brandTotal: number;
  isLoadingBrands: boolean;
  brandHasMore: boolean;
  isFetchingMoreBrands: boolean;
  onLoadMoreBrands: () => void;
  onBrandSearchChange: (search: string) => void;
  brandHasQuery: boolean;
  selectedDepartment: string | null;
  onDepartmentChange: (dept: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSetup: () => void;
  projectId: string | null;
  onProjectChange: (project: ProjectOption | null) => void;
  selectedProject: ProjectOption | null;
  projectSearch: string;
  projectTotal: number;
  isLoadingProjects: boolean;
  projectHasMore: boolean;
  isFetchingMoreProjects: boolean;
  onLoadMoreProjects: () => void;
  projectScopeBrandName: string | null;
  selectedProjectStatus: ProjectOption["status"] | null;
  selectedProjectSourceType: ProjectOption["projectType"] | null;
  onProjectStatusChange: (status: ProjectOption["status"] | null) => void;
  onProjectSourceTypeChange: (sourceType: ProjectOption["projectType"] | null) => void;
  onProjectSearchChange: (search: string) => void;
  projectHasQuery: boolean;
}

const FilterBarComponent = ({
  brands,
  selectedBrand,
  departments,
  projects,
  selectedBrandId,
  onBrandChange,
  brandSearch,
  brandTotal,
  isLoadingBrands,
  brandHasMore,
  isFetchingMoreBrands,
  onLoadMoreBrands,
  onBrandSearchChange,
  brandHasQuery,
  selectedDepartment,
  onDepartmentChange,
  searchQuery,
  onSearchChange,
  onOpenSetup,
  projectId,
  onProjectChange,
  selectedProject,
  projectSearch,
  projectTotal,
  isLoadingProjects,
  projectHasMore,
  isFetchingMoreProjects,
  onLoadMoreProjects,
  projectScopeBrandName,
  selectedProjectStatus,
  selectedProjectSourceType,
  onProjectStatusChange,
  onProjectSourceTypeChange,
  onProjectSearchChange,
  projectHasQuery,
}: FilterBarProps) => {
  const { session, logout } = useAuth();
  const hasFullAccess = isFullAccess(session);
  const hasDashboardAccess = canAccessDashboard(session);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 p-4 border-b bg-card" data-testid="filter-bar">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon icon="lucide:filter" className="text-muted-foreground" />
          <span className="font-medium">Filters:</span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Icon icon="lucide:search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="filter-search-input"
            placeholder="Search name, position, project, brand..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 w-full sm:w-auto min-w-[200px]"
          />
        </div>

        <BrandFilterCombobox
          value={selectedBrandId}
          brands={brands}
          selectedBrand={selectedBrand}
          brandSearch={brandSearch}
          brandTotal={brandTotal}
          isLoading={isLoadingBrands}
          hasMore={brandHasMore}
          isFetchingNextPage={isFetchingMoreBrands}
          onLoadMore={onLoadMoreBrands}
          onChange={onBrandChange}
          onBrandSearchChange={onBrandSearchChange}
          hasQuery={brandHasQuery}
        />

        <ProjectFilterCombobox
          value={projectId}
          projects={projects}
          selectedProject={selectedProject}
          projectSearch={projectSearch}
          projectTotal={projectTotal}
          isLoading={isLoadingProjects}
          hasMore={projectHasMore}
          isFetchingNextPage={isFetchingMoreProjects}
          onLoadMore={onLoadMoreProjects}
          scopeBrandName={projectScopeBrandName}
          selectedStatus={selectedProjectStatus}
          selectedSourceType={selectedProjectSourceType}
          onStatusChange={onProjectStatusChange}
          onSourceTypeChange={onProjectSourceTypeChange}
          onChange={onProjectChange}
          onProjectSearchChange={onProjectSearchChange}
          hasQuery={projectHasQuery}
        />

        <Select
          value={selectedDepartment || "all"}
          onValueChange={(val) => onDepartmentChange(val === "all" ? null : val)}
        >
          <SelectTrigger
            className="w-full sm:w-auto min-w-[140px] max-w-[200px]"
            data-testid="filter-department-trigger"
            aria-label="Filter by department"
          >
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem key="all" value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                  {dept.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
        <ExportButton
          filters={{
            brandId: selectedBrandId,
            departmentId: selectedDepartment,
            projectId,
            startDate: undefined, // These would come from a date range picker if implemented
            endDate: undefined,
          }}
        />
        {DASHBOARD_FEATURE_ENABLED && hasDashboardAccess && (
          <Button asChild variant="outline" data-testid="open-dashboard-button">
            <Link href="/dashboard">
              <Icon icon="lucide:layout-dashboard" className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        )}
        {hasFullAccess && (
          <Button onClick={onOpenSetup} variant="outline" data-testid="open-setup-button">
            <Icon icon="lucide:settings" className="mr-2 h-4 w-4" />
            Setup
          </Button>
        )}

        {/* User Menu */}
        {session && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Icon icon="lucide:user" className="h-4 w-4" />
                <span className="hidden sm:inline">{session.employee.nickname || session.employee.full_name}</span>
                <Icon icon="lucide:chevron-down" className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{session.employee.full_name}</p>
                <p className="text-xs text-muted-foreground">{session.employee.position}</p>
                <p className="text-xs text-muted-foreground">Dept: {session.employee.department_name}</p>
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <p className="text-xs text-muted-foreground">
                  Access: <span className={`font-medium ${hasFullAccess ? 'text-green-600' : 'text-orange-600'}`}>
                    {hasFullAccess ? 'Full' : 'Restricted'}
                  </span>
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <Icon icon="lucide:log-out" className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

export const FilterBar = React.memo(FilterBarComponent);
FilterBar.displayName = "FilterBar";
