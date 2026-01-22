"use client";

import React, { useState } from "react";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject, type Project } from "@/lib/query/hooks/useProjects";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PROJECT_COLORS = [
  "#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

export const ProjectSetup = () => {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const createProject = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  const resetForm = () => {
    setName("");
    setBrandId(brands[0]?.id || "");
    setColor(PROJECT_COLORS[0]);
    setEditingProject(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (project: Project) => {
    setName(project.name);
    setBrandId(project.brandId);
    setColor(project.color);
    setEditingProject(project);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !brandId) return;

    if (editingProject) {
      updateProjectMutation.mutate({
        id: editingProject.id,
        name: name.trim(),
        brandId,
        color,
      }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          resetForm();
        }
      });
    } else {
      createProject.mutate({
        name: name.trim(),
        brandId,
        color,
        status: 'active',
      }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          resetForm();
        }
      });
    }
  };

  const handleDelete = (projectId: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      deleteProjectMutation.mutate(projectId);
    }
  };

  // Group projects by brand
  const projectsByBrand = brands.map((brand) => ({
    brand,
    projects: projects.filter((p) => p.brandId === brand.id),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Projects</h3>
          <p className="text-sm text-muted-foreground">
            Manage projects within your brands
          </p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      {/* Projects List grouped by Brand */}
      <div className="space-y-6">
        {projectsByBrand.map(({ brand, projects: brandProjects }) => (
          <div key={brand.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: brand.color }}
              />
              <h4 className="font-medium text-sm">{brand.name}</h4>
              <span className="text-xs text-muted-foreground">
                ({brandProjects.length} projects)
              </span>
            </div>

            {brandProjects.length === 0 ? (
              <div className="text-sm text-muted-foreground pl-5">
                No projects yet
              </div>
            ) : (
              <div className="grid gap-2 pl-5">
                {brandProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: project.color }}
                      >
                        <Icon icon="lucide:folder" className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{project.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {project.assignments?.length || 0} assignments
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(project)}
                      >
                        <Icon icon="lucide:pencil" className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(project.id)}
                      >
                        <Icon icon="lucide:trash-2" className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Edit Project" : "Add Project"}
            </DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Update the project details"
                : "Create a new project within a brand"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Project Name</label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Website Redesign"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="brand" className="text-sm font-medium">Brand</label>
              <select
                id="brand"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select a brand...</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      color === c && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || !brandId || createProject.isPending || updateProjectMutation.isPending}
            >
              {createProject.isPending || updateProjectMutation.isPending
                ? "Saving..."
                : editingProject ? "Save Changes" : "Add Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
