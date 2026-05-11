"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useInfiniteEmployees } from "@/lib/query/hooks/useEmployees";
import { useAssignmentsByProject, useCreateAssignment, useDeleteAssignment } from "@/lib/query/hooks/useAssignments";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { format } from "date-fns";

interface AssignEmployeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectColor: string;
  onAssignPending?: (employeeIds: string[]) => void;
}

export const AssignEmployeesDialog: React.FC<AssignEmployeesDialogProps> = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectColor,
  onAssignPending,
}) => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch existing assignments for this project
  const { data: existingAssignments = [] } = useAssignmentsByProject(projectId);

  // Use infinite query for employees with search
  const {
    data: employeesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingEmployees,
  } = useInfiniteEmployees(debouncedSearch);

  // Mutations
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();

  // Flatten employees from all pages
  const employees = useMemo(() => {
    if (!employeesData?.pages) return [];
    return employeesData.pages.flatMap((page) => page.data);
  }, [employeesData]);

  // Get currently assigned employees
  const assignedEmployees = useMemo(() => {
    return existingAssignments
      .filter((assignment) => assignment.employee)
      .map((assignment) => ({
        assignmentId: assignment.id,
        employee: assignment.employee!,
      }));
  }, [existingAssignments]);

  // Get assigned employee IDs for easy lookup
  const assignedEmployeeIds = useMemo(() => {
    return new Set(assignedEmployees.map((a) => a.employee.id));
  }, [assignedEmployees]);

  // Filter out already assigned employees from available list
  const availableEmployees = useMemo(() => {
    return employees.filter((emp) => !assignedEmployeeIds.has(emp.id));
  }, [employees, assignedEmployeeIds]);

  // Refs for infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const loadMoreElement = loadMoreRef.current;

    if (!scrollContainer || !loadMoreElement) return;

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
        rootMargin: "100px",
      }
    );

    observer.observe(loadMoreElement);

    return () => {
      observer.unobserve(loadMoreElement);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Toggle employee selection
  const handleToggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  // Remove assigned employee
  const handleRemoveAssigned = async (assignmentId: string) => {
    try {
      await deleteAssignment.mutateAsync(assignmentId);
    } catch (error) {
      console.error("Failed to remove assignment:", error);
    }
  };

  // Assign selected employees
  const handleAssign = useCallback(async () => {
    if (selectedEmployeeIds.size === 0) return;

    setIsAssigning(true);

    try {
      // Call the callback to add to pending list
      onAssignPending?.(Array.from(selectedEmployeeIds));

      // Clear selection and close dialog
      setSelectedEmployeeIds(new Set());
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to process assignments:", error);
    } finally {
      setIsAssigning(false);
    }
  }, [selectedEmployeeIds, onAssignPending, onOpenChange]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedEmployeeIds(new Set());
      setSearch("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Team Members</DialogTitle>
          <DialogDescription>
            Add people to{" "}
            <span
              className="inline-block w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: projectColor }}
            />
            {projectName}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-2">
          <Icon
            icon="lucide:search"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Currently Assigned Section */}
        {assignedEmployees.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Currently Assigned ({assignedEmployees.length})
            </h4>
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
              {assignedEmployees.map(({ assignmentId, employee }) => (
                <div
                  key={assignmentId}
                  className="flex items-center justify-between p-2 rounded-lg border bg-green-50 border-green-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <Icon icon="lucide:check" className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{employee.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {employee.position}
                        {employee.department && ` • ${employee.department.name}`}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemoveAssigned(assignmentId)}
                  >
                    <Icon icon="lucide:x" className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Employees Section */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Available Employees
          </h4>
          <div
            ref={scrollContainerRef}
            className="max-h-[300px] overflow-y-auto space-y-1"
          >
            {isLoadingEmployees && availableEmployees.length === 0 ? (
              // Initial loading skeleton
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg border animate-pulse"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                    <div className="w-5 h-5 rounded border-2 border-gray-200" />
                  </div>
                ))}
              </div>
            ) : availableEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon icon="lucide:users-x" className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {search
                    ? `No employees found matching "${search}"`
                    : "All employees are already assigned"}
                </p>
              </div>
            ) : (
              <>
                {availableEmployees.map((employee) => {
                  const isSelected = selectedEmployeeIds.has(employee.id);

                  return (
                    <div
                      key={employee.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary/5 border-primary"
                          : "hover:bg-accent/50 border-transparent"
                      )}
                      onClick={() => handleToggleEmployee(employee.id)}
                    >
                      {/* Employee Icon */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
                        style={{
                          backgroundColor: employee.department?.color || "#6366f1",
                        }}
                      >
                        {employee.fullName.charAt(0).toUpperCase()}
                      </div>

                      {/* Employee Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {employee.fullName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {employee.position}
                          {employee.department && ` • ${employee.department.name}`}
                        </div>
                      </div>

                      {/* Checkbox */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-gray-300"
                        )}
                      >
                        {isSelected && (
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
                      Loading more employees...
                    </div>
                  ) : hasNextPage ? (
                    <div className="text-xs text-muted-foreground">
                      Scroll to load more
                    </div>
                  ) : availableEmployees.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {availableEmployees.length} employee
                      {availableEmployees.length !== 1 ? "s" : ""} shown
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedEmployeeIds.size === 0 || isAssigning}
          >
            {isAssigning ? (
              <>
                <Icon icon="lucide:loader-2" className="h-4 w-4 mr-1 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Icon icon="lucide:user-plus" className="h-4 w-4 mr-1" />
                Assign {selectedEmployeeIds.size > 0 ? `(${selectedEmployeeIds.size})` : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
