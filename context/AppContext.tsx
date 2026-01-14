"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Resource, Brand, Assignment } from "@/types";
import { mockResources, mockBrands, mockAssignments } from "@/lib/mockData";

type AppContextType = {
  resources: Resource[];
  brands: Brand[];
  assignments: Assignment[];
  addResource: (resource: Resource) => void;
  updateResource: (resource: Resource) => void;
  addBrand: (brand: Brand) => void;
  updateBrand: (brand: Brand) => void;
  addAssignment: (assignment: Assignment) => void;
  updateAssignment: (assignment: Assignment) => void;
  deleteAssignment: (id: string) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [resources, setResources] = useState<Resource[]>(mockResources);
  const [brands, setBrands] = useState<Brand[]>(mockBrands);
  const [assignments, setAssignments] = useState<Assignment[]>(mockAssignments);

  // Load from local storage on mount (optional, skipping for now to rely on mock data or adding persistence later)

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
        assignments,
        addResource,
        updateResource,
        addBrand,
        updateBrand,
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
