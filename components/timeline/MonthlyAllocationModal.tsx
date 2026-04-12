"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AssignmentCategory } from "@/types";
import { format, startOfDay, isBefore, isAfter, isEqual } from "date-fns";
import { distributeMonthlyHours, type DistributionResult } from "@/lib/utils/allocation-distributor";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Project } from "@/lib/query/hooks/useProjects";

interface MonthlyAllocationModalProps {
  monthStart: Date;
  monthEnd: Date;
  resource: {
    id: string;
    name: string;
  };
  project: Project;
  existingAssignment?: Assignment; // If present, we're in EDIT mode
  timeOffAssignments: Assignment[];
  position: { x: number; y: number };
  monthlyTotalHours?: number; // Total hours for this month (from highlighted block)
  onClose: () => void;
  onSave: (data: {
    projectId: string;
    totalHours: number;
    startDate: Date;
    endDate: Date;
    distributions: Array<{ date: Date; hours: number }>;
    category: AssignmentCategory;
    isBillable: boolean;
    note?: string;
  }) => void;
  onDelete?: () => void;
}

export const MonthlyAllocationModal: React.FC<MonthlyAllocationModalProps> = ({
  monthStart,
  monthEnd,
  resource,
  project,
  existingAssignment,
  timeOffAssignments,
  position,
  monthlyTotalHours,
  onClose,
  onSave,
  onDelete,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [totalHours, setTotalHours] = useState("0");
  const [hoursError, setHoursError] = useState<string | null>(null);
  const today = startOfDay(new Date());
  const [startDate, setStartDate] = useState(() => startOfDay(monthStart));
  const [endDate, setEndDate] = useState(() => startOfDay(monthEnd));
  const [dateError, setDateError] = useState<string | null>(null);
  const [category, setCategory] = useState<AssignmentCategory>("Development");
  const [isBillable, setIsBillable] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  // Track whether user has manually edited the hours (to prevent auto-overwrite)
  const [userHasEditedHours, setUserHasEditedHours] = useState(false);

  // Determine if we're in edit mode
  const isEditMode = !!existingAssignment;

  // Log when in edit mode and when props change
  useEffect(() => {
    if (isEditMode && existingAssignment) {
      console.log('[MonthlyAllocationModal] Edit mode opened/props changed:', {
        id: existingAssignment.id,
        monthlyTotalHours,
        monthlyTotalHoursType: typeof monthlyTotalHours,
        userHasEditedHours
      });
    }
  }, [isEditMode, existingAssignment?.id, monthlyTotalHours, onDelete, userHasEditedHours]);

  // Initialize form values - only set if user hasn't manually edited yet
  useEffect(() => {
    if (existingAssignment && !userHasEditedHours) {
      // EDIT mode: default to today until end of month (same as CREATE mode)
      // But cap today at month end if today is past the month
      const defaultStart = today > monthEnd ? monthEnd : today;
      setStartDate(startOfDay(defaultStart));
      setEndDate(startOfDay(monthEnd));

      // Set total hours from the pre-calculated monthly total (from highlighted block)
      const hoursValue = monthlyTotalHours?.toString() ?? "0";
      setTotalHours(hoursValue);

      if (existingAssignment.category) {
        setCategory(existingAssignment.category as AssignmentCategory);
      }
      setIsBillable(existingAssignment.isBillable);
    } else if (!userHasEditedHours && !existingAssignment) {
      // CREATE mode: default to today until end of month
      // But cap today at month end if today is past the month
      const defaultStart = today > monthEnd ? monthEnd : today;
      setStartDate(startOfDay(defaultStart));
      setEndDate(startOfDay(monthEnd));
      setTotalHours("0"); // Default to 0 in create mode
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingAssignment?.id, monthlyTotalHours]);

  useEffect(() => {
    setMounted(true);
    // Reset deleting state on mount
    setIsDeleting(false);
    // Reset userHasEditedHours flag when modal first mounts
    setUserHasEditedHours(false);
    // Cleanup on unmount
    return () => {
      setIsDeleting(false);
    };
  }, []);

  // Reset userHasEditedHours flag when a new assignment is opened (modal re-opens)
  useEffect(() => {
    setUserHasEditedHours(false);
  }, [existingAssignment?.id, monthlyTotalHours]);

  // Calculate distribution in real-time based on SELECTED date range
  const distributionResult = useMemo((): DistributionResult => {
    const hours = parseFloat(totalHours.replace(",", "."));

    // Validate date range
    if (startDate > endDate) {
      setDateError("Start date must be before end date");
      return {
        distributions: [],
        totalDays: 0,
        totalHours: 0,
        hoursPerDay: 0,
        skippedDays: 0,
        remainingHours: 0,
        blockedDays: { timeOff: 0, weekend: 0 },
      };
    }

    setDateError(null);

    if (isNaN(hours) || hours <= 0) {
      return {
        distributions: [],
        totalDays: 0,
        totalHours: 0,
        hoursPerDay: 0,
        skippedDays: 0,
        remainingHours: 0,
        blockedDays: { timeOff: 0, weekend: 0 },
      };
    }

    // Use the SELECTED date range, not the entire month
    return distributeMonthlyHours({
      totalHours: hours,
      monthStart: startDate,
      monthEnd: endDate,
      timeOffAssignments,
    });
  }, [totalHours, startDate, endDate, timeOffAssignments]);

  // Check if selected range is in the past
  const isPastRange = endDate < today || endDate.getTime() === today.getTime();

  // Check if any distributions will be created
  const hasDistributions = distributionResult.distributions.length > 0;

  const handleSave = () => {
    const hours = parseFloat(totalHours.replace(",", "."));
    console.log('[MonthlyAllocationModal] handleSave:', {
      totalHoursInput: totalHours,
      parsedHours: hours,
      distributionTotalHours: distributionResult.totalHours,
      distributionHoursPerDay: distributionResult.hoursPerDay
    });
    if (isNaN(hours) || hours <= 0) {
      setHoursError("Please enter a valid number of hours");
      return;
    }

    if (startDate > endDate) {
      setDateError("Start date must be before end date");
      return;
    }

    if (!hasDistributions) {
      setHoursError("No working days available in selected date range");
      return;
    }

    onSave({
      projectId: project.id,
      totalHours: hours,
      startDate,
      endDate,
      distributions: distributionResult.distributions.map(d => ({
        date: d.date,
        hours: d.hours,
      })),
      category,
      isBillable,
      note: note || undefined,
    });
  };

  const categories: AssignmentCategory[] = [
    "Research",
    "Development",
    "Design",
    "Meeting",
    "Admin",
    "Other",
  ];

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed z-[9999] bg-white rounded-lg shadow-xl border p-4 min-w-[450px] max-w-[500px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 520),
        top: Math.min(position.y, window.innerHeight - 500),
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: project.color || "#ccc" }}
          />
          <div className="flex flex-col">
            <span className="font-medium text-sm">{project.name}</span>
            <span className="text-xs text-muted-foreground">
              {format(monthStart, "MMMM yyyy")}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close modal"
        >
          <Icon icon="lucide:x" className="h-4 w-4" />
        </button>
      </div>

      {/* Mode indicator */}
      <div className="mb-3">
        <span className={`text-xs font-semibold px-2 py-1 rounded ${
          isEditMode
            ? "bg-amber-100 text-amber-800"
            : "bg-blue-100 text-blue-800"
        }`}>
          {isEditMode ? "EDIT MODE" : "CREATE MODE"}
        </span>
      </div>

      {/* Past date warning */}
      {isPastRange && (
        <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
          <Icon icon="lucide:alert-triangle" className="h-4 w-4 text-amber-600 mt-0.5" />
          <span className="text-xs text-amber-800">
            Creating assignments for past dates
          </span>
        </div>
      )}

      {/* Date Range Inputs */}
      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-1 block">
          Date Range
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              type="date"
              value={format(startDate, "yyyy-MM-dd")}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                setStartDate(startOfDay(newDate));
                setDateError(null);
              }}
              className="text-sm"
              min={format(isEditMode ? monthStart : today, "yyyy-MM-dd")}
              max={format(monthEnd, "yyyy-MM-dd")}
            />
          </div>
          <span className="text-muted-foreground">to</span>
          <div className="flex-1">
            <Input
              type="date"
              value={format(endDate, "yyyy-MM-dd")}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                setEndDate(startOfDay(newDate));
                setDateError(null);
              }}
              className="text-sm"
              min={format(startDate, "yyyy-MM-dd")}
              max={format(monthEnd, "yyyy-MM-dd")}
            />
          </div>
        </div>
        {dateError && (
          <p className="text-xs text-red-500 mt-1">{dateError}</p>
        )}
      </div>

      {/* Total Hours Input */}
      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-1 block">
          Total Hours
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={totalHours}
            onChange={(e) => {
              setTotalHours(e.target.value);
              setHoursError(null);
              setUserHasEditedHours(true);
            }}
            className={`w-24 text-center${hoursError ? " border-red-500 focus-visible:ring-red-500" : ""}`}
            placeholder="0"
            min="0.5"
            max="320"
            step="0.5"
          />
          <span className="text-xs text-muted-foreground">hours</span>
        </div>
        {hoursError && (
          <p className="text-xs text-red-500 mt-1">{hoursError}</p>
        )}
      </div>

      {/* Distribution Preview */}
      <div className="mb-4 p-3 bg-gray-50 rounded-md border">
        <div className="text-xs font-semibold text-gray-700 mb-2">
          Distribution: {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
        </div>

        {!hasDistributions ? (
          <div className="text-xs text-gray-500">
            {distributionResult.totalDays === 0
              ? "No working days available in selected date range"
              : "Enter hours to see distribution"
            }
          </div>
        ) : (
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Working days:</span>
              <span className="font-semibold">{distributionResult.totalDays} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Hours per day:</span>
              <span className="font-semibold">{distributionResult.hoursPerDay.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total to allocate:</span>
              <span className="font-semibold text-blue-600">{distributionResult.totalHours.toFixed(1)}h</span>
            </div>
            {distributionResult.remainingHours > 0 && (
              <div className="flex justify-between mt-1 pt-1 border-t border-amber-200">
                <span className="text-amber-700">⚠️ Remaining (not allocated):</span>
                <span className="font-semibold text-amber-700">{distributionResult.remainingHours.toFixed(1)}h</span>
              </div>
            )}
            {distributionResult.skippedDays > 0 && (
              <>
                <div className="my-2 border-t border-gray-200"></div>
                <div className="text-xs text-gray-500">Skipped days:</div>
                {distributionResult.blockedDays.weekend > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Weekends:</span>
                    <span>{distributionResult.blockedDays.weekend}</span>
                  </div>
                )}
                {distributionResult.blockedDays.timeOff > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Time off:</span>
                    <span>{distributionResult.blockedDays.timeOff}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Category */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: project.color || "#ccc" }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AssignmentCategory)}
            className="flex-1 border rounded px-2 py-1.5 text-sm bg-background"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="flex items-center gap-6 mb-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={!isBillable}
            onCheckedChange={(checked) => setIsBillable(!checked)}
          />
          Non-Billable
        </label>
      </div>

      {/* Note */}
      <details className="mb-3" open={noteOpen}>
        <summary
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer select-none"
          onClick={(e) => {
            e.preventDefault();
            setNoteOpen(!noteOpen);
          }}
        >
          <Icon
            icon={noteOpen ? "lucide:chevron-down" : "lucide:chevron-right"}
            className="h-3 w-3"
          />
          Note
        </summary>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border rounded p-2 text-sm resize-none mt-2"
          rows={2}
          placeholder="Add a note..."
        />
      </details>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t mt-4">
        <Button
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-sm"
        >
          Cancel
        </Button>
        {isEditMode && onDelete && (
          <Button
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              if (isDeleting) return;
              console.log('Delete button clicked, calling onDelete');
              setIsDeleting(true);
              onDelete();
            }}
            disabled={isDeleting}
            className="text-sm"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        )}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
          disabled={!hasDistributions || hoursError !== null || dateError !== null}
          className="text-sm"
        >
          Save
        </Button>
      </div>
    </div>,
    document.body
  );
};
