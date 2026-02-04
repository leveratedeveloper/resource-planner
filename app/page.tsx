"use client";

import { useState, useMemo } from "react";
import { FilterBar } from "@/components/filters/FilterBar";
import { SetupManager } from "@/components/setup/SetupManager";
import { Timeline } from "@/components/timeline/Timeline";
import { InsightsPanel } from "@/components/insights/InsightsPanel";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useApp } from "@/context/AppContext";
import { useEmployees } from "@/lib/query/hooks/useEmployees";
import { useAssignments } from "@/lib/query/hooks/useAssignments";
import { useDebounce } from "@/hooks/use-debounce";
import type { AnalysisAssignment } from "@/lib/analysis/types";

export default function Home() {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  const { analysisResult, isAnalyzing, refreshAnalysis } = useApp();
  const { data: employees = [] } = useEmployees();
  const { data: assignments = [] } = useAssignments();

  const mappedAssignments: AnalysisAssignment[] = useMemo(
    () =>
      assignments.map((a) => ({
        id: a.id,
        resourceId: a.employeeId,
        projectId: a.projectId || "",
        startDate: new Date(a.startDate),
        endDate: new Date(a.endDate),
        hoursPerDay: parseFloat(a.hoursPerDay),
        isTimeOff: a.isTimeOff,
        category: a.category || "Other",
        isBillable: a.isBillable,
        note: a.note,
      })),
    [assignments]
  );

  const resources = useMemo(
    () =>
      employees.map((emp) => ({
        id: emp.id,
        name: emp.fullName,
        role: emp.position,
        department: emp.department?.name || "",
        capacity: emp.weeklyCapacity,
      })),
    [employees]
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <FilterBar
        selectedBrandId={selectedBrandId}
        onBrandChange={setSelectedBrandId}
        selectedDepartment={selectedDepartment}
        onDepartmentChange={setSelectedDepartment}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSetup={() => setIsSetupOpen(true)}
        onOpenInsights={() => setIsInsightsOpen(true)}
      />

      <main className="flex-1 overflow-hidden">
        <Timeline 
          brandId={selectedBrandId} 
          department={selectedDepartment}
          searchQuery={debouncedSearch}
        />
      </main>

      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="w-full h-[90vh] overflow-y-auto">
          <div className="sr-only">
            <DialogTitle>Setup</DialogTitle>
            <DialogDescription>
              Manage your brands and team resources.
            </DialogDescription>
          </div>
          <SetupManager />
        </DialogContent>
      </Dialog>

      <InsightsPanel
        isOpen={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
        result={analysisResult}
        isAnalyzing={isAnalyzing}
        onRefresh={refreshAnalysis}
        resources={resources}
        assignments={mappedAssignments}
      />
    </div>
  );
}
