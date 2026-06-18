"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { useAddProjectStore } from "@/lib/timeline-v2/add-project-store";

type AddProjectLaneRowProps = {
  resourceId: string;
  assignedProjectIds: string[];
};

// Sits below an expanded employee's project lanes. Opens the project picker so
// the planner can assign a project the employee is not yet on. Matches the lane
// row height/label geometry (h-timeline-lane, pl-12) so it reads as part of the
// lane stack.
export const AddProjectLaneRow = React.memo(function AddProjectLaneRow({
  resourceId,
  assignedProjectIds,
}: AddProjectLaneRowProps) {
  const openPicker = useAddProjectStore((state) => state.open);

  return (
    <div className="flex h-timeline-lane border-b bg-blue-50/10" data-testid="add-project-lane-row">
      <div className="sticky left-0 z-20 flex h-full w-[var(--timeline-resource-col)] shrink-0 items-center border-r bg-background pl-12 pr-3">
        <button
          type="button"
          onClick={() => openPicker({ resourceId, assignedProjectIds })}
          className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 hover:text-blue-900"
          data-testid="add-project-button"
        >
          <Icon icon="lucide:plus" className="h-3.5 w-3.5" />
          Add project
        </button>
      </div>
      <div className="relative h-full flex-1" />
    </div>
  );
});
