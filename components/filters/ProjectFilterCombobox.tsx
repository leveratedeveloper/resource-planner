"use client";

import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { cn } from "@/lib/utils";

function formatFilterLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

type ProjectFilterComboboxProps = {
  value: string | null;
  projects: ProjectOption[];
  selectedProject: ProjectOption | null;
  projectSearch: string;
  projectTotal: number;
  isLoading: boolean;
  scopeBrandName: string | null;
  selectedStatus: ProjectOption["status"] | null;
  selectedSourceType: ProjectOption["projectType"] | null;
  onStatusChange: (status: ProjectOption["status"] | null) => void;
  onSourceTypeChange: (sourceType: ProjectOption["projectType"] | null) => void;
  onChange: (projectId: string | null) => void;
  onProjectSearchChange: (search: string) => void;
};

export function ProjectFilterCombobox({
  value,
  projects,
  selectedProject,
  projectSearch,
  projectTotal,
  isLoading,
  scopeBrandName,
  selectedStatus,
  selectedSourceType,
  onStatusChange,
  onSourceTypeChange,
  onChange,
  onProjectSearchChange,
}: ProjectFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedProjectOption = useMemo(
    () => selectedProject ?? projects.find((project) => project.id === value) ?? null,
    [projects, selectedProject, value]
  );

  const renderedProjects = useMemo(() => {
    const byId = new Map<string, ProjectOption>();
    if (selectedProjectOption) {
      byId.set(selectedProjectOption.id, selectedProjectOption);
    }
    for (const project of projects) {
      if (!byId.has(project.id)) {
        byId.set(project.id, project);
      }
    }
    return Array.from(byId.values());
  }, [projects, selectedProjectOption]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = projectSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return renderedProjects;
    }

    return renderedProjects.filter((project) =>
      [project.name, project.brandName, project.brandCompanyName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch))
    );
  }, [projectSearch, renderedProjects]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full min-w-[160px] max-w-[240px] justify-between sm:w-auto"
          data-testid="filter-project-trigger"
          aria-label="Filter by project"
        >
          <span className="min-w-0 truncate">
            {selectedProjectOption ? selectedProjectOption.name : "All Projects"}
          </span>
          <Icon icon="lucide:chevrons-up-down" className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className="rounded-sm px-2 py-0.5 text-[11px]">
              {scopeBrandName ? `Brand: ${scopeBrandName}` : "All projects"}
            </Badge>
            {selectedStatus ? (
              <Badge variant="outline" className="rounded-sm px-2 py-0.5 text-[11px]">
                Status: {selectedStatus}
              </Badge>
            ) : null}
            {selectedSourceType ? (
              <Badge variant="outline" className="rounded-sm px-2 py-0.5 text-[11px]">
                Type: {selectedSourceType}
              </Badge>
            ) : null}
          </div>

          <div className="relative">
            <Icon icon="lucide:search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={projectSearch}
              onChange={(event) => onProjectSearchChange(event.target.value)}
              placeholder="Search projects..."
              className="h-9 pl-9"
              data-testid="filter-project-search-input"
            />
          </div>

          <div className="space-y-2 rounded-md border bg-muted/20 p-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Icon icon="lucide:activity" className="h-3.5 w-3.5" />
              Status
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(["planning", "active", "on_hold", "completed", "cancelled"] as const).map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={selectedStatus === status ? "default" : "outline"}
                  size="sm"
                  className="h-7 w-full rounded-sm px-2 text-xs"
                  onClick={() => onStatusChange(selectedStatus === status ? null : status)}
                >
                  {formatFilterLabel(status)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/20 p-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Icon icon="lucide:layers" className="h-3.5 w-3.5" />
              Project Type
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(["campaign", "pitch"] as const).map((sourceType) => (
                <Button
                  key={sourceType}
                  type="button"
                  variant={selectedSourceType === sourceType ? "default" : "outline"}
                  size="sm"
                  className="h-7 rounded-sm px-2 text-xs"
                  onClick={() => onSourceTypeChange(selectedSourceType === sourceType ? null : sourceType)}
                >
                  {formatFilterLabel(sourceType)}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="h-[260px] rounded-md border">
            <div className="p-1">
              <button
                type="button"
                className={cn(
                  "flex h-8 w-full items-center rounded-sm px-2 text-left text-sm hover:bg-accent",
                  value === null && "bg-accent"
                )}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                All Projects
              </button>

              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={cn(
                    "flex h-8 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-left text-sm hover:bg-accent",
                    value === project.id && "bg-accent"
                  )}
                  onClick={() => {
                    onChange(project.id);
                    setOpen(false);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate">{project.name}</span>
                </button>
              ))}

              {filteredProjects.length === 0 && !isLoading ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No projects found
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {isLoading ? "Loading..." : `${filteredProjects.length} of ${projectTotal} projects`}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
