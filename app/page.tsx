"use client";

import { useState } from "react";
import { FilterBar } from "@/components/filters/FilterBar";
import { SetupManager } from "@/components/setup/SetupManager";
import { Timeline } from "@/components/timeline/Timeline";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export default function Home() {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-background">
      <FilterBar
        selectedBrandId={selectedBrandId}
        onBrandChange={setSelectedBrandId}
        selectedDepartment={selectedDepartment}
        onDepartmentChange={setSelectedDepartment}
        onOpenSetup={() => setIsSetupOpen(true)}
      />

      <main className="flex-1 overflow-hidden">
        <Timeline brandId={selectedBrandId} department={selectedDepartment} />
      </main>

      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="max-w-7xl h-[90vh] overflow-y-auto">
          <SetupManager />
        </DialogContent>
      </Dialog>
    </div>
  );
}
