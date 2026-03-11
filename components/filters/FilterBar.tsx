"use client";

import React from "react";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useDepartments } from "@/lib/query/hooks/useDepartments";
import { useProjects } from "@/lib/query/hooks/useProjects";
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

// Assignment categories
export const ASSIGNMENT_CATEGORIES = [
  "Design",
  "Development",
  "Research",
  "Meeting",
  "Planning",
  "Testing",
  "Documentation",
  "Review",
  "Other",
] as const;

// Assignment statuses
export const ASSIGNMENT_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
] as const;

interface FilterBarProps {
  selectedBrandId: string | null;
  onBrandChange: (brandId: string | null) => void;
  selectedDepartment: string | null;
  onDepartmentChange: (dept: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSetup: () => void;
  onOpenInsights: () => void;
  // Assignment filters
  projectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  category: string | null;
  onCategoryChange: (category: string | null) => void;
  status: string | null;
  onStatusChange: (status: string | null) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedBrandId,
  onBrandChange,
  selectedDepartment,
  onDepartmentChange,
  searchQuery,
  onSearchChange,
  onOpenSetup,
  onOpenInsights,
  projectId,
  onProjectChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
}) => {
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { data: departments = [], isLoading: departmentsLoading } = useDepartments();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

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

        <Select
          value={selectedBrandId || "all"}
          onValueChange={(val) => onBrandChange(val === "all" ? null : val)}
        >
          <SelectTrigger
            className="w-full sm:w-auto min-w-[140px] max-w-[200px]"
            data-testid="filter-brand-trigger"
            aria-label="Filter by brand"
          >
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem key="all" value="all">All Brands</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: brand.color }} />
                  {brand.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        {/* Project Filter */}
        <Select
          value={projectId || "all"}
          onValueChange={(val) => onProjectChange(val === "all" ? null : val)}
        >
          <SelectTrigger
            className="w-full sm:w-auto min-w-[140px] max-w-[200px]"
            data-testid="filter-project-trigger"
            aria-label="Filter by project"
          >
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem key="all" value="all">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* More Dropdown with Category, Status, Clear All */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="filter-more-trigger">
              More
              <Icon icon="lucide:chevron-down" className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {/* Category Filter */}
            <div className="px-2 py-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category: {category || "All"}</label>
            </div>
            {ASSIGNMENT_CATEGORIES.map((cat) => (
              <DropdownMenuItem
                key={cat}
                onClick={() => onCategoryChange(category === cat ? null : cat)}
                data-testid={`filter-category-${cat.toLowerCase()}`}
              >
                <Icon
                  icon={category === cat ? "lucide:check" : "lucide:circle"}
                  className="mr-2 h-4 w-4"
                />
                {cat}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Status Filter */}
            <div className="px-2 py-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status: {status || "All"}</label>
            </div>
            {ASSIGNMENT_STATUSES.map((statusOption) => (
              <DropdownMenuItem
                key={statusOption.value}
                onClick={() => onStatusChange(statusOption.value === "all" ? null : statusOption.value)}
                data-testid={`filter-status-${statusOption.value.toLowerCase()}`}
              >
                <Icon
                  icon={status === statusOption.value || (status === null && statusOption.value === "all") ? "lucide:check" : "lucide:circle"}
                  className="mr-2 h-4 w-4"
                />
                {statusOption.label}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Clear All Filters */}
            <DropdownMenuItem
              onClick={() => {
                onProjectChange(null);
                onCategoryChange(null);
                onStatusChange(null);
              }}
              disabled={!projectId && !category && !status}
              data-testid="filter-clear-all"
            >
              <Icon icon="lucide:x" className="mr-2 h-4 w-4" />
              Clear Assignment Filters
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
        <Button onClick={onOpenInsights} variant="default" data-testid="open-insights-button">
          <Icon icon="lucide:brain" className="mr-2 h-4 w-4" />
          AI Insights
        </Button>
        <Button onClick={onOpenSetup} variant="outline" data-testid="open-setup-button">
          <Icon icon="lucide:settings" className="mr-2 h-4 w-4" />
          Setup / Manage Brands
        </Button>
      </div>
    </div>
  );
};
