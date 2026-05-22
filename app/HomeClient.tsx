"use client";

import { useState } from "react";
import { FilterBar } from "@/components/filters/FilterBar";
import { SetupManager } from "@/components/setup/SetupManager";
import { Timeline } from "@/components/timeline/Timeline";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";

interface HomeClientProps {
  initialTimelineAnchor: string;
}

export function HomeClient({ initialTimelineAnchor }: HomeClientProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

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
        projectId={filterProjectId}
        onProjectChange={setFilterProjectId}
        category={filterCategory}
        onCategoryChange={setFilterCategory}
        status={filterStatus}
        onStatusChange={setFilterStatus}
      />

      <main className="flex-1 overflow-hidden">
        <Timeline
          initialTimelineAnchor={initialTimelineAnchor}
          brandId={selectedBrandId}
          department={selectedDepartment}
          searchQuery={debouncedSearch}
          projectId={filterProjectId}
          category={filterCategory}
          status={filterStatus}
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
    </div>
  );
}
