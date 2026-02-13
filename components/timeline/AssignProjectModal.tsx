"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useEmployees } from "@/lib/query/hooks/useEmployees";
import { useInfiniteProjects } from "@/lib/query/hooks/useProjects";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useAssignments, useCreateAssignment } from "@/lib/query/hooks/useAssignments";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

interface AssignProjectModalProps {
  resourceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AssignProjectModal: React.FC<AssignProjectModalProps> = ({
  resourceId,
  open,
  onOpenChange,
}) => {
  const { data: employees = [] } = useEmployees();
  const { data: brands = [] } = useBrands();
  const { data: assignments = [] } = useAssignments();
  const createAssignment = useCreateAssignment();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // Use infinite query for projects with debounced search
  const {
    data: projectsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingProjects,
  } = useInfiniteProjects(debouncedSearch);

  // Flatten projects from all pages
  const projects = useMemo(() => {
    if (!projectsData?.pages) return [];
    return projectsData.pages.flatMap((page) => page.data);
  }, [projectsData]);

  // State to track when scroll container is mounted
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [loadMoreElement, setLoadMoreElement] = useState<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Callback refs to capture when elements mount
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    setScrollContainer(node);
  }, []);

  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    setLoadMoreElement(node);
  }, []);

  // Intersection observer - triggered when both elements are available
  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // Can't set up observer without both elements
    if (!scrollContainer || !loadMoreElement) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { 
        root: scrollContainer,
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    observer.observe(loadMoreElement);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [scrollContainer, loadMoreElement, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const resource = employees.find((r) => r.id === resourceId);

  // O(1) brand lookup using Map
  const brandMap = useMemo(() => 
    new Map(brands.map(b => [b.id, b])), 
    [brands]
  );

  // O(1) check if resource is already assigned to a project
  const assignedProjectIds = useMemo(() => {
    const set = new Set<string>();
    assignments
      .filter(a => a.employeeId === resourceId)
      .forEach(a => a.projectId && set.add(a.projectId));
    return set;
  }, [assignments, resourceId]);

  const isAssigned = (projectId: string) => assignedProjectIds.has(projectId);

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleAssign = useCallback(async () => {
    if (!resourceId || selectedProjectIds.size === 0) return;

    setIsCreating(true);

    try {
      // Create minimal assignments for each selected project
      // Uses today's date and 0 hours so it doesn't affect capacity
      // User can then drag on timeline to set actual dates/hours
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      const promises = Array.from(selectedProjectIds).map((projectId) =>
        createAssignment.mutateAsync({
          employeeId: resourceId,
          projectId: projectId,
          taskId: null,
          startDate: today,
          endDate: today,
          hoursPerDay: "0", // 0 hours = no capacity impact
          allocationPercentage: null,
          isTimeOff: false,
          timeOffTypeId: null,
          category: "Core",
          isBillable: true,
          status: "draft",
          note: "Assigned via project modal - set dates and hours on timeline",
          createdById: null,
        })
      );

      await Promise.all(promises);

      setSelectedProjectIds(new Set());
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create assignments:", error);
    } finally {
      setIsCreating(false);
    }
  }, [resourceId, selectedProjectIds, createAssignment, onOpenChange]);


  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedProjectIds(new Set());
      setSearch("");
    }
  }, [open]);

  if (!resource) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="assign-project-modal">
        <DialogHeader>
          <DialogTitle>Add to project(s)</DialogTitle>
          <DialogDescription>{resource.fullName}</DialogDescription>
        </DialogHeader>

        {/* Search and Filter */}
        <div className="flex items-center gap-2 mt-2">
          <Button variant="default" size="sm" className="shrink-0">
            All
            <Icon icon="lucide:chevron-down" className="h-3 w-3 ml-1" />
          </Button>
          <Button variant="outline" size="sm" className="shrink-0">
            <Icon icon="lucide:filter" className="h-3 w-3 mr-1" />
            Filter
          </Button>
          <div className="relative flex-1">
            <Icon
              icon="lucide:search"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              data-testid="assign-project-search-input"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Project List - with ref for scroll container */}
        <div 
          ref={scrollContainerRef}
          className="mt-4 max-h-[400px] overflow-y-auto space-y-1"
        >
          {isLoadingProjects && projects.length === 0 ? (
            // Initial loading skeleton
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg border animate-pulse"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                  <div className="w-5 h-5 rounded border-2 border-gray-200" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {projects.map((project) => {
                const brand = brandMap.get(project.brandId);
                const alreadyAssigned = isAssigned(project.id);
                const isSelected = selectedProjectIds.has(project.id);

                return (
                  <div
                    key={project.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                      alreadyAssigned
                        ? "bg-gray-50 border-gray-200"
                        : isSelected
                        ? "bg-primary/5 border-primary"
                        : "hover:bg-accent/50 border-transparent"
                    )}
                    onClick={() => !alreadyAssigned && toggleProject(project.id)}
                    data-testid="assign-project-item"
                    data-project-id={project.id}
                  >
                    {/* Project Icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: project.color }}
                    >
                      <Icon icon="lucide:folder" className="h-4 w-4 text-white" />
                    </div>

                    {/* Project Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{project.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {brand?.name}
                        {alreadyAssigned && " • Already assigned"}
                      </div>
                    </div>

                    {/* Role Selector (simplified) */}
                    <div className="shrink-0">
                      <select
                        className="text-xs border rounded px-2 py-1 bg-background"
                        onClick={(e) => e.stopPropagation()}
                        defaultValue={resource.position}
                      >
                        <option>{resource.position}</option>
                        <option>Designer</option>
                        <option>Developer</option>
                        <option>Manager</option>
                        <option>Analyst</option>
                      </select>
                    </div>

                    {/* Checkbox */}
                    <div
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                        alreadyAssigned
                          ? "bg-green-500 border-green-500"
                          : isSelected
                          ? "bg-primary border-primary"
                          : "border-gray-300"
                      )}
                    >
                      {(alreadyAssigned || isSelected) && (
                        <Icon icon="lucide:check" className="h-3 w-3 text-white" />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Load more trigger / loading indicator */}
              <div ref={loadMoreRef} className="py-4 text-center">
                {isFetchingNextPage ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
                    Loading more projects...
                  </div>
                ) : hasNextPage ? (
                  <div className="text-xs text-muted-foreground">
                    Scroll to load more
                  </div>
                ) : projects.length > 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {projects.length} project{projects.length !== 1 ? "s" : ""} loaded
                  </div>
                ) : null}
              </div>

              {projects.length === 0 && !isLoadingProjects && (
                <div className="text-center py-8 text-muted-foreground">
                  No projects found{search ? ` matching "${search}"` : ""}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="assign-project-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedProjectIds.size === 0 || isCreating}
            data-testid="assign-project-confirm"
          >
            {isCreating ? (
              <>
                <Icon icon="lucide:loader-2" className="h-4 w-4 mr-1 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Icon icon="lucide:plus" className="h-4 w-4 mr-1" />
                Add to {selectedProjectIds.size || ""} Project{selectedProjectIds.size !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
