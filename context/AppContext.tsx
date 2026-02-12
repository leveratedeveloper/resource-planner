"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import { useEmployees, useAssignments, useProjects, useBrands } from "@/lib/query/hooks";
import { useCapacityAnalysis } from "@/hooks/useCapacityAnalysis";
import { AnalysisResult, AnalysisAssignment, AnalysisProject, AnalysisBrand } from "@/lib/analysis/types";

// Simplified context for UI state only - data fetching is handled by React Query
type AppContextType = {
  // UI State
  selectedDateRange: { start: Date; end: Date };
  setSelectedDateRange: (range: { start: Date; end: Date }) => void;

  selectedBrandFilter: string | null;
  setSelectedBrandFilter: (brandId: string | null) => void;

  selectedDepartmentFilter: string | null;
  setSelectedDepartmentFilter: (dept: string | null) => void;

  // Analysis results (from Web Worker)
  analysisResult: AnalysisResult | null;
  isAnalyzing: boolean;
  analysisError: Error | null;
  refreshAnalysis: () => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // UI State
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string | null>(null);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string | null>(null);
  
  // Default date range: start from a week ago, look 3 months ahead
  const [selectedDateRange, setSelectedDateRange] = useState<{ start: Date; end: Date }>(() => {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    return { start, end };
  });

  // Fetch data using React Query hooks
  const { data: employees = [] } = useEmployees();
  const { data: assignments = [] } = useAssignments();
  const { data: projects = [] } = useProjects();
  const { data: brands = [] } = useBrands();

  // Transform data for analysis (match the expected format)
  const analysisResources = useMemo(() => {
    return employees.map((emp) => ({
      id: emp.id,
      name: emp.fullName,
      role: emp.position,
      department: emp.department?.name || "",
      capacity: emp.weeklyCapacity,
    }));
  }, [employees]);

  const analysisAssignments = useMemo<AnalysisAssignment[]>(() => {
    return assignments.map((assign) => ({
      id: assign.id,
      resourceId: assign.employeeId,
      projectId: assign.projectId || "",
      startDate: new Date(assign.startDate),
      endDate: new Date(assign.endDate),
      hoursPerDay: parseFloat(String(assign.hoursPerDay)),
      isTimeOff: assign.isTimeOff,
      category: assign.category || "Other",
      isBillable: assign.isBillable,
      note: assign.note,
    }));
  }, [assignments]);

  // Index assignments by projectId for deriving resourceIds
  const assignmentsByProject = useMemo(() => {
    const index = new Map<string, Set<string>>();
    for (const a of assignments) {
      if (!a.projectId) continue;
      const set = index.get(a.projectId) ?? new Set();
      set.add(a.employeeId);
      index.set(a.projectId, set);
    }
    return index;
  }, [assignments]);

  const analysisProjects = useMemo<AnalysisProject[]>(() => {
    return projects.map((proj) => ({
      id: proj.id,
      name: proj.name,
      brandId: proj.brandId,
      color: proj.color || "#6366f1",
      resourceIds: [...(assignmentsByProject.get(proj.id) ?? [])],
    }));
  }, [projects, assignmentsByProject]);

  const analysisBrands = useMemo<AnalysisBrand[]>(() => {
    return brands.map((brand) => {
      const resourceSet = new Set<string>();
      for (const proj of projects) {
        if (proj.brandId === brand.id) {
          for (const id of assignmentsByProject.get(proj.id) ?? []) {
            resourceSet.add(id);
          }
        }
      }
      return {
        id: brand.id,
        name: brand.name,
        color: brand.color || "#6366f1",
        resourceIds: [...resourceSet],
      };
    });
  }, [brands, projects, assignmentsByProject]);

  // Capacity analysis (runs in Web Worker)
  const {
    result: analysisResult,
    isAnalyzing,
    error: analysisError,
    refresh: refreshAnalysis,
  } = useCapacityAnalysis(
    analysisResources,
    analysisAssignments,
    analysisProjects,
    analysisBrands,
    selectedDateRange,
    { enabled: analysisAssignments.length > 0, debounceMs: 500 }
  );

  return (
    <AppContext.Provider
      value={{
        // UI State
        selectedDateRange,
        setSelectedDateRange,
        selectedBrandFilter,
        setSelectedBrandFilter,
        selectedDepartmentFilter,
        setSelectedDepartmentFilter,
        // Analysis results
        analysisResult,
        isAnalyzing,
        analysisError,
        refreshAnalysis,
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
