"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Resource, AssignmentCategory } from "@/types";
import { differenceInDays, startOfWeek, endOfWeek, isWithinInterval, startOfDay, addWeeks, addDays } from "date-fns";
import { useAssignments, useCreateAssignment, useUpdateAssignment } from "@/lib/query/hooks/useAssignments";
import { useProjects } from "@/lib/query/hooks/useProjects";
import { useBrands } from "@/lib/query/hooks/useBrands";
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
  isWeekView?: boolean;
}

// Allocation Cell Component
const AllocationCell: React.FC<{ day: Date; resource: Resource; assignments: any[]; cellWidth: number; isWeekView?: boolean }> = ({
  day,
  resource,
  assignments,
  cellWidth,
  isWeekView = false
}) => {
  const dailyCapacity = resource.capacity / 5; // Assuming 5 day week
  
  // For week view, aggregate hours across the week (Mon-Fri)
  // For day view, just check the single day
  const getDaysToCheck = () => {
    if (!isWeekView) {
      return [startOfDay(new Date(day))];
    }
    // Return all weekdays in the week starting from this day
    const weekDays: Date[] = [];
    const weekStart = startOfDay(new Date(day));
    for (let i = 0; i < 5; i++) {
      const d = addDays(weekStart, i);
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        weekDays.push(d);
      }
    }
    return weekDays;
  };
  
  const daysToCheck = getDaysToCheck();
  
  // Calculate average hours per day across the period
  let totalHours = 0;
  let workingDaysCount = 0;
  
  for (const currentDay of daysToCheck) {
    const dayOfWeek = currentDay.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    workingDaysCount++;
    
    const dayHours = assignments.filter(a => !a.isTimeOff).reduce((total, assignment) => {
      if (assignment.employeeId !== resource.id) return total;
      
      const assignStart = startOfDay(new Date(assignment.startDate));
      const assignEnd = startOfDay(new Date(assignment.endDate));
      
      if (currentDay >= assignStart && currentDay <= assignEnd) {
        return total + assignment.hoursPerDay;
      }
      
      return total;
    }, 0);
    
    totalHours += dayHours;
  }
  
  const dailyHours = workingDaysCount > 0 ? totalHours / workingDaysCount : 0;

  // Time off check - check if ANY day in the period has time off
  const hasTimeOff = daysToCheck.some(currentDay =>
    assignments.some(a =>
      a.employeeId === resource.id &&
      a.isTimeOff &&
      isWithinInterval(currentDay, {
        start: startOfDay(new Date(a.startDate)),
        end: startOfDay(new Date(a.endDate))
      })
    )
  );

  if (hasTimeOff) {
    // Only show label if cells are wide enough
    const showLabel = cellWidth >= 40;

    return (
      <div
        className="shrink-0 h-[60px] border-r border-white/20 bg-gray-400 flex items-center justify-center text-xs font-bold text-white"
        style={{ width: cellWidth }}
      >
        {showLabel && (cellWidth >= 60 ? "Time Off" : "TO")}
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

export const ResourceRow: React.FC<ResourceRowProps> = ({ resource, days, brandId, onAssignProject, cellWidth = 100, isWeekView = false }) => {
  const { data: assignments = [] } = useAssignments();
  const { data: projects = [] } = useProjects();
  const { data: brands = [] } = useBrands();
  const createAssignment = useCreateAssignment();
  const updateAssignmentMutation = useUpdateAssignment();
  const [isExpanded, setIsExpanded] = useState(false);

  // Popover state for creating assignments
  const [popoverData, setPopoverData] = useState<{
    projectId: string;
    startDate: Date;
    endDate: Date;
    position: { x: number; y: number };
  } | null>(null);

  // All assignments for this resource
  const resourceAssignments = assignments.filter((a) => a.employeeId === resource.id);
  
  // Get projects this resource is assigned to
  const resourceProjects = useMemo(() => {
    const projectIds = new Set(resourceAssignments.filter(a => !a.isTimeOff).map(a => a.projectId));
    return projects.filter(p => projectIds.has(p.id));
  }, [resourceAssignments, projects]);

  // Check if has time off
  const hasTimeOff = resourceAssignments.some(a => a.isTimeOff);
  
  // Get time-off assignments for this resource (used to block scheduling on time-off days)
  const timeOffAssignments = useMemo(() => 
    resourceAssignments.filter(a => a.isTimeOff),
    [resourceAssignments]
  );

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

    createAssignment.mutate({
      employeeId: resource.id,
      projectId: popoverData.projectId,
      startDate: popoverData.startDate.toISOString(),
      endDate: popoverData.endDate.toISOString(),
      hoursPerDay: data.hoursPerDay,
      isTimeOff: false,
      category: data.category,
      isBillable: data.isBillable,
      note: data.note,
    });

    setPopoverData(null);
  }, [popoverData, resource.id, createAssignment]);

  // Handle time-off drag complete - create time-off directly (no popover needed)
  const handleTimeOffDragComplete = useCallback((startDay: Date, endDay: Date) => {
    createAssignment.mutate({
      employeeId: resource.id,
      projectId: null, // No project for time-off
      startDate: startDay.toISOString(),
      endDate: endDay.toISOString(),
      hoursPerDay: 8, // Full day time-off
      isTimeOff: true,
      category: 'other' as AssignmentCategory,
      isBillable: false,
      note: 'Time Off',
    });
  }, [resource.id, createAssignment]);

  // Handle resize update
  const handleUpdateAssignment = useCallback((id: string, updates: { startDate?: Date; endDate?: Date }) => {
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) return;

    updateAssignmentMutation.mutate({
      id,
      startDate: updates.startDate?.toISOString() || new Date(assignment.startDate).toISOString(),
      endDate: updates.endDate?.toISOString() || new Date(assignment.endDate).toISOString(),
    });
  }, [assignments, updateAssignmentMutation]);

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
              isWeekView={isWeekView}
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
              isWeekView={isWeekView}
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
            <DraggableTimelineCell
              key={day.toISOString()}
              day={day}
              projectId=""
              projectColor="#6b7280"
              days={days}
              cellWidth={cellWidth}
              cellHeight={50}
              isTimeOffMode={true}
              onDragComplete={(startDay, endDay) => 
                handleTimeOffDragComplete(startDay, endDay)
              }
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
              isWeekView={isWeekView}
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
                  timeOffAssignments={timeOffAssignments}
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
                  isWeekView={isWeekView}
                  onUpdate={handleUpdateAssignment}
                  timeOffAssignments={timeOffAssignments}
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
