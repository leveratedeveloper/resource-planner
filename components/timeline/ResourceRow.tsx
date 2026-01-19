"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Resource, AssignmentCategory } from "@/types";
import { differenceInDays, startOfWeek, endOfWeek, isWithinInterval, startOfDay, addWeeks } from "date-fns";
import { useApp } from "@/context/AppContext";
import { AssignmentBlock } from "./AssignmentBlock";
import { DraggableTimelineCell } from "./DraggableTimelineCell";
import { AssignmentPopover } from "./AssignmentPopover";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ResourceRowProps {
  resource: Resource;
  days: Date[];
  brandId: string | null;
  onAssignProject?: (resourceId: string) => void;
  cellWidth?: number;
}

// Allocation Cell Component
const AllocationCell: React.FC<{ day: Date; resource: Resource; assignments: ReturnType<typeof useApp>["assignments"]; cellWidth: number }> = ({
  day,
  resource,
  assignments,
  cellWidth
}) => {
  const dailyCapacity = resource.capacity / 5; // Assuming 5 day week
  
  // Calculate hours for this specific day
  const dailyHours = assignments.filter(a => !a.isTimeOff).reduce((total, assignment) => {
    if (assignment.resourceId !== resource.id) return total;
    
    // Check if day is within assignment range
    const assignStart = startOfDay(new Date(assignment.startDate));
    const assignEnd = startOfDay(new Date(assignment.endDate));
    const currentDay = startOfDay(new Date(day));
    
    if (currentDay >= assignStart && currentDay <= assignEnd) {
      // Check if weekend (skip if standard assignment)
      const dayOfWeek = currentDay.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return total;
      
      return total + assignment.hoursPerDay;
    }
    
    return total;
  }, 0);

  // Time off check
  const isTimeOff = assignments.some(a =>
    a.resourceId === resource.id &&
    a.isTimeOff &&
    isWithinInterval(startOfDay(new Date(day)), {
      start: startOfDay(new Date(a.startDate)),
      end: startOfDay(new Date(a.endDate))
    })
  );

  if (isTimeOff) {
    // Only show label if cells are wide enough
    const showLabel = cellWidth >= 60;

    return (
      <div
        className="shrink-0 h-[60px] border-r border-white/20 bg-gray-400 flex items-center justify-center text-xs font-bold text-white"
        style={{ width: cellWidth }}
      >
        {showLabel && "Time Off"}
      </div>
    );
  }

  const percentage = dailyHours / dailyCapacity;
  
  // Styling based on percentage
  let bgClass = "";
  let textClass = "text-white"; // Default white text for darker backgrounds
  let label = "";
  let borderClass = "";

  if (percentage <= 0) {
    return (
      <div 
        className="shrink-0 h-[60px] border-r border-dashed"
        style={{ width: cellWidth }}
      />
    );
  } else if (percentage <= 1) {
    // Dynamic blue scale for 1-100%
    // 0-25%: blue-200 (lightest visible)
    // 26-50%: blue-300
    // 51-75%: blue-400
    // 76-100%: blue-500
    if (percentage <= 0.25) {
      bgClass = "bg-blue-200";
      textClass = "text-blue-900"; // Dark text for light background
    } else if (percentage <= 0.5) {
      bgClass = "bg-blue-300";
      textClass = "text-blue-900";
    } else if (percentage <= 0.75) {
      bgClass = "bg-blue-400";
      textClass = "text-white";
    } else {
      bgClass = "bg-blue-500";
      textClass = "text-white";
    }
    
    label = `${Math.round(percentage * 100)}%`;
  } else {
    bgClass = "bg-blue-800"; // Over 100%
    textClass = "text-white";
    label = `${Math.round(percentage * 100)}%`;
    borderClass = "border-t-4 border-red-500";
  }

  // Only show label if cells are wide enough (e.g. not Month view)
  const showLabel = cellWidth >= 60;

  return (
    <div 
      className={cn(
        "shrink-0 h-[60px] border-r border-white/20 flex items-center justify-center text-xs font-bold transition-all",
        bgClass,
        textClass,
        borderClass
      )}
      style={{ width: cellWidth }}
    >
      {showLabel && label}
    </div>
  );
};

export const ResourceRow: React.FC<ResourceRowProps> = ({ resource, days, brandId, onAssignProject, cellWidth = 100 }) => {
  const { assignments, projects, brands, addAssignment, updateAssignment } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  // Popover state for creating assignments
  const [popoverData, setPopoverData] = useState<{
    projectId: string;
    startDate: Date;
    endDate: Date;
    position: { x: number; y: number };
  } | null>(null);

  // All assignments for this resource
  const resourceAssignments = assignments.filter((a) => a.resourceId === resource.id);
  
  // Get projects this resource is assigned to
  const resourceProjects = useMemo(() => {
    const projectIds = new Set(resourceAssignments.filter(a => !a.isTimeOff).map(a => a.projectId));
    return projects.filter(p => projectIds.has(p.id));
  }, [resourceAssignments, projects]);

  // Check if has time off
  const hasTimeOff = resourceAssignments.some(a => a.isTimeOff);

  // Handle drag complete - open popover
  const handleDragComplete = useCallback((projectId: string, startDay: Date, endDay: Date, position: { x: number; y: number }) => {
    setPopoverData({ projectId, startDate: startDay, endDate: endDay, position });
  }, []);

  // Handle save assignment
  const handleSaveAssignment = useCallback((data: {
    hoursPerDay: number;
    category: AssignmentCategory;
    isBillable: boolean;
    note?: string;
  }) => {
    if (!popoverData) return;

    addAssignment({
      id: `a${Date.now()}`,
      resourceId: resource.id,
      projectId: popoverData.projectId,
      startDate: popoverData.startDate,
      endDate: popoverData.endDate,
      hoursPerDay: data.hoursPerDay,
      isTimeOff: false,
      category: data.category,
      isBillable: data.isBillable,
      note: data.note,
    });

    setPopoverData(null);
  }, [popoverData, resource.id, addAssignment]);

  // Handle resize update
  const handleUpdateAssignment = useCallback((id: string, updates: { startDate?: Date; endDate?: Date }) => {
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) return;
    
    updateAssignment({
      ...assignment,
      startDate: updates.startDate || assignment.startDate,
      endDate: updates.endDate || assignment.endDate,
    });
  }, [assignments, updateAssignment]);

  // Collapsed row content
  if (!isExpanded) {
    return (
      <div className="flex border-b hover:bg-accent/5 transition-colors group">
        {/* Sidebar Info - Collapsed */}
        <div className="w-[250px] shrink-0 p-4 border-r sticky left-0 bg-background z-20 flex items-center gap-3">
          <button 
            onClick={() => setIsExpanded(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon icon="lucide:chevron-right" className="h-4 w-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
            {resource.name.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{resource.name}</div>
            <div className="text-xs text-muted-foreground truncate">{resource.role} | {resource.department}</div>
          </div>
        </div>

        {/* Allocation Bar - Collapsed */}
        <div className="flex relative flex-1">
          {days.map((day) => (
            <AllocationCell 
              key={day.toISOString()}
              day={day}
              resource={resource}
              assignments={resourceAssignments}
              cellWidth={cellWidth}
            />
          ))}
        </div>
      </div>
    );
  }

  // Expanded row content
  return (
    <div className="border-b">
      {/* Main Row Header */}
      <div className="flex hover:bg-accent/5 transition-colors group">
        <div className="w-[250px] shrink-0 p-4 border-r sticky left-0 bg-background z-20 flex items-center gap-3">
          <button 
            onClick={() => setIsExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon icon="lucide:chevron-down" className="h-4 w-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
            {resource.name.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{resource.name}</div>
            <div className="text-xs text-muted-foreground truncate">{resource.role} | {resource.department}</div>
          </div>
        </div>

        {/* Allocation Bar - Expanded (Header) */}
        <div className="flex relative flex-1">
          {days.map((day) => (
            <AllocationCell 
              key={day.toISOString()}
              day={day}
              resource={resource}
              assignments={resourceAssignments}
              cellWidth={cellWidth}
            />
          ))}
        </div>
      </div>

      {/* Time Off Row */}
      <div className="flex bg-gray-50/50 h-[50px]">
        <div className="w-[250px] shrink-0 px-4 border-r sticky left-0 bg-gray-50/50 z-20 flex items-center gap-2 pl-12 h-[50px]">
          <Icon icon="lucide:calendar-off" className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Time Off</span>
        </div>
        <div className="flex relative flex-1 h-[50px]">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="shrink-0 h-full border-r border-dashed"
              style={{ width: cellWidth }}
            />
          ))}
          {/* Time Off Assignments */}
          {resourceAssignments.filter(a => a.isTimeOff).map((assignment) => (
            <AssignmentBlock
              key={assignment.id}
              assignment={assignment}
              days={days}
              resourceRowHeight={50}
              cellWidth={cellWidth}
              onUpdate={handleUpdateAssignment}
            />
          ))}
        </div>
      </div>

      {/* Project Rows */}
      {resourceProjects.map((project) => {
        const brand = brands.find(b => b.id === project.brandId);
        const projectAssignments = resourceAssignments.filter(a => a.projectId === project.id && !a.isTimeOff);
        
        return (
          <div key={project.id} className="flex bg-white">
            <div className="w-[250px] shrink-0 px-4 py-2 border-r sticky left-0 bg-white z-20 flex items-center gap-2 pl-12">
              <div 
                className="w-4 h-4 rounded flex items-center justify-center"
                style={{ backgroundColor: project.color }}
              >
                <Icon icon="lucide:folder" className="h-3 w-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{project.name}</div>
                <div className="text-xs text-muted-foreground truncate">{brand?.name}</div>
              </div>
            </div>
            <div className="flex relative flex-1" style={{ height: 60 }}>
              {days.map((day) => (
                <DraggableTimelineCell
                  key={day.toISOString()}
                  day={day}
                  projectId={project.id}
                  projectColor={project.color}
                  days={days}
                  cellWidth={cellWidth}
                  cellHeight={60}
                  onDragComplete={(startDay, endDay, position) => 
                    handleDragComplete(project.id, startDay, endDay, position)
                  }
                />
              ))}
              {/* Project Assignments */}
              {projectAssignments.map((assignment) => (
                <AssignmentBlock
                  key={assignment.id}
                  assignment={assignment}
                  days={days}
                  resourceRowHeight={60}
                  cellWidth={cellWidth}
                  onUpdate={handleUpdateAssignment}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Assign Project Button Row */}
      <div className="flex bg-gray-50/30">
        <div className="w-[250px] shrink-0 px-4 py-3 border-r sticky left-0 bg-gray-50/30 z-20 flex items-center gap-4 pl-12">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs"
            onClick={() => onAssignProject?.(resource.id)}
          >
            <Icon icon="lucide:plus" className="h-3 w-3 mr-1" />
            Assign Project
          </Button>
          {resourceProjects.length > 2 && (
            <span className="text-xs text-muted-foreground">
              Show all ({resourceProjects.length})
            </span>
          )}
        </div>
        <div className="flex relative flex-1">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="shrink-0 h-[40px] border-r border-dashed"
              style={{ width: cellWidth }}
            />
          ))}
        </div>
      </div>

      {/* Assignment Popover */}
      {popoverData && (
        <AssignmentPopover
          resourceId={resource.id}
          projectId={popoverData.projectId}
          startDate={popoverData.startDate}
          endDate={popoverData.endDate}
          position={popoverData.position}
          onClose={() => setPopoverData(null)}
          onSave={handleSaveAssignment}
        />
      )}
    </div>
  );
};
