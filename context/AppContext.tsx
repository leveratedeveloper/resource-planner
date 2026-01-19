"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Resource, Brand, Project, Assignment } from "@/types";
import { mockResources, mockBrands, mockProjects, createMockAssignments } from "@/lib/mockData";

type AppContextType = {
  resources: Resource[];
  brands: Brand[];
  projects: Project[];
  assignments: Assignment[];
  addResource: (resource: Resource) => void;
  updateResource: (resource: Resource) => void;
  addBrand: (brand: Brand) => void;
  updateBrand: (brand: Brand) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  addAssignment: (assignment: Assignment) => void;
  updateAssignment: (assignment: Assignment) => void;
  deleteAssignment: (id: string) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [resources, setResources] = useState<Resource[]>(mockResources);
  const [brands, setBrands] = useState<Brand[]>(mockBrands);
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Initialize assignments on client-side only to avoid hydration mismatch
  useEffect(() => {
    setAssignments(createMockAssignments());
  }, []);

  const addResource = (resource: Resource) => {
    setResources((prev) => [...prev, resource]);
  };

  const updateResource = (updated: Resource) => {
    setResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const addBrand = (brand: Brand) => {
    setBrands((prev) => [...prev, brand]);
  };

  const updateBrand = (updated: Brand) => {
    setBrands((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const addProject = (project: Project) => {
    setProjects((prev) => [...prev, project]);
  };

  const updateProject = (updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const addAssignment = (assignment: Assignment) => {
    setAssignments((prev) => [...prev, assignment]);
  };

  const updateAssignment = (updated: Assignment) => {
    setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const deleteAssignment = (id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        resources,
        brands,
        projects,
        assignments,
        addResource,
        updateResource,
        addBrand,
        updateBrand,
        addProject,
        updateProject,
        deleteProject,
        addAssignment,
        updateAssignment,
        deleteAssignment,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
