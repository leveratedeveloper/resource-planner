"use client";

import React from "react";
import { Resource, Assignment } from "@/types";
import { format, isSameDay } from "date-fns";
import { useApp } from "@/context/AppContext";
import { AssignmentBlock } from "./AssignmentBlock";

interface ResourceRowProps {
  resource: Resource;
  days: Date[];
  brandId: string | null;
}

export const ResourceRow: React.FC<ResourceRowProps> = ({ resource, days, brandId }) => {
  const { assignments } = useApp();

  // specific assignments for this resource
  const resourceAssignments = assignments.filter((a) => a.resourceId === resource.id);

  // Check capacity warnings? (TODO)

  return (
    <div className="flex border-b hover:bg-accent/5 transition-colors group">
      {/* Sidebar Info */}
      <div className="w-[250px] shrink-0 p-4 border-r sticky left-0 bg-background z-20 flex flex-col justify-center">
        <div className="font-medium text-sm">{resource.name}</div>
        <div className="text-xs text-muted-foreground">{resource.role}</div>
      </div>

      {/* Grid */}
      <div className="flex relative">
         {/* Background Grid Cells */}
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="w-[100px] shrink-0 h-[80px] border-r border-dashed"
          />
        ))}

        {/* Assignments Overlay */}
        {resourceAssignments.map((assignment) => (
            <AssignmentBlock
                key={assignment.id}
                assignment={assignment}
                days={days}
                resourceRowHeight={80}
            />
        ))}
      </div>
    </div>
  );
};
