"use client";

import React, { useState, useMemo } from "react";
import { useEmployees } from "@/lib/query/hooks/useEmployees";
import { useProjects } from "@/lib/query/hooks/useProjects";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useAssignments } from "@/lib/query/hooks/useAssignments";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

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
  const { data: projects = [] } = useProjects();
  const { data: brands = [] } = useBrands();
  const { data: assignments = [] } = useAssignments();
  const [search, setSearch] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

  const resource = employees.find((r) => r.id === resourceId);

  // Get projects grouped by brand
  const projectsByBrand = useMemo(() => {
    const grouped = new Map<string, typeof projects>();
    
    projects.forEach((project) => {
      const existing = grouped.get(project.brandId) || [];
      existing.push(project);
      grouped.set(project.brandId, existing);
    });
    
    return grouped;
  }, [projects]);

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const lowerSearch = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerSearch) ||
        brands.find((b) => b.id === p.brandId)?.name.toLowerCase().includes(lowerSearch)
    );
  }, [projects, brands, search]);

  // Check if resource is already assigned to a project
  const isAssigned = (projectId: string) => {
    return assignments.some((a) => a.employeeId === resourceId && a.projectId === projectId);
  };

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

  const handleAssign = () => {
    if (!resourceId) return;

    // Note: In the new schema, we need to create actual assignment records with dates and hours
    // This feature is disabled for now - assignments should be created via timeline drag-and-drop
    console.log("Selected projects:", selectedProjectIds);
    alert("This feature is being updated. Please use the timeline to drag and drop assignments with specific dates and hours.");

    setSelectedProjectIds(new Set());
    onOpenChange(false);
  };

  if (!resource) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
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
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="mt-4 max-h-[400px] overflow-y-auto space-y-1">
          {filteredProjects.map((project) => {
            const brand = brands.find((b) => b.id === project.brandId);
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

          {filteredProjects.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No projects found matching "{search}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedProjectIds.size === 0}
          >
            <Icon icon="lucide:plus" className="h-4 w-4 mr-1" />
            Add to {selectedProjectIds.size || ""} Project{selectedProjectIds.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
