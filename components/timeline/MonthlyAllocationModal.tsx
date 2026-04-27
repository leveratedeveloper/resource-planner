"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AssignmentCategory } from "@/types";
import { format, startOfDay, startOfMonth, isBefore, isAfter, isEqual, isSameMonth } from "date-fns";
import { distributeMonthlyHours, type DistributionResult } from "@/lib/utils/allocation-distributor";
import { validateActualHoursLimit } from "@/lib/utils/actual-hours-validation";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Project } from "@/lib/query/hooks/useProjects";

interface MonthlyAllocationModalProps {
  monthStart: Date;
  monthEnd: Date;
  resource: {
    id: string;
    name: string;
    role: string;
  };
  project: Project;
  existingAssignment?: Assignment; // If present, we're in EDIT mode
  existingActualAssignment?: ActualAssignment; // If present in actual mode, we're in EDIT mode
  mode?: 'plan' | 'actual'; // Determines if this is for plan or actual allocations
  timeOffAssignments: Assignment[];
  adjustmentAssignments?: Assignment[]; // adjustment records yang sudah ada
  isFullAccess?: boolean; // whether user has full access
  monthlyTotalHours?: number; // Total hours for this month (from highlighted block)
  planTotalHours?: number; // Plan-only hours (excluding adjustments)
  adjustmentTotalHours?: number; // Adjustment-only hours for this month
  plannedHoursLimit?: number; // Total planned hours limit (plan + adj) for actual validation
  currentActualHours?: number; // Already allocated actual hours for this project-month
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
    adjustmentHours?: number;
    adjustmentStartDate?: Date;
    adjustmentEndDate?: Date;
    adjustmentDistributions?: Array<{ date: Date; hours: number }>;
    removeAdjustment?: boolean;
    planHoursChanged?: boolean; // Whether user changed the plan hours input
  }) => void;
  onDelete?: () => void;
}

export const MonthlyAllocationModal: React.FC<MonthlyAllocationModalProps> = ({
  monthStart,
  monthEnd,
  resource,
  project,
  existingAssignment,
  existingActualAssignment,
  mode = 'plan',
  timeOffAssignments,
  adjustmentAssignments,
  isFullAccess,
  monthlyTotalHours,
  planTotalHours,
  adjustmentTotalHours,
  plannedHoursLimit,
  currentActualHours,
  onClose,
  onSave,
  onDelete,
}) => {
  const isActual = mode === 'actual';
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

  // Adjustment state
  const [adjustmentHours, setAdjustmentHours] = useState("0");
  const [adjustmentStartDate, setAdjustmentStartDate] = useState(() => startOfDay(monthStart));
  const [adjustmentEndDate, setAdjustmentEndDate] = useState(() => startOfDay(monthEnd));
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [removeAdjustment, setRemoveAdjustment] = useState(false);

  // Determine if we're in edit mode
  const isEditMode = isActual ? !!existingActualAssignment : !!existingAssignment;

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
    if (isActual && existingActualAssignment && !userHasEditedHours) {
      // ACTUAL EDIT mode
      const editDefaultStart = isSameMonth(today, monthStart)
        ? (today > monthEnd ? monthEnd : today)
        : monthStart;
      setStartDate(startOfDay(editDefaultStart));
      setEndDate(startOfDay(monthEnd));

      const hoursValue = monthlyTotalHours?.toString() ?? "0";
      setTotalHours(hoursValue);

      if (existingActualAssignment.category) {
        setCategory(existingActualAssignment.category as AssignmentCategory);
      }
      setIsBillable(existingActualAssignment.isBillable);
    } else if (!isActual && existingAssignment && !userHasEditedHours) {
      // PLAN EDIT mode: default to today if same month, otherwise start from 1st of that month
      // But cap today at month end if today is past the month
      const editDefaultStart = isSameMonth(today, monthStart)
        ? (today > monthEnd ? monthEnd : today)
        : monthStart;
      setStartDate(startOfDay(editDefaultStart));
      setEndDate(startOfDay(monthEnd));

      // Set total hours from plan-only hours (excluding adjustments) to avoid double-counting
      const hoursValue = planTotalHours?.toString() ?? "0";
      setTotalHours(hoursValue);

      if (existingAssignment.category) {
        setCategory(existingAssignment.category as AssignmentCategory);
      }
      setIsBillable(existingAssignment.isBillable);

      // Initialize adjustment hours from prop (pre-computed in ResourceRow block renderer)
      if (adjustmentTotalHours && adjustmentTotalHours > 0) {
        setAdjustmentHours(adjustmentTotalHours.toString());
        setAdjustmentStartDate(startOfDay(monthStart));
        setAdjustmentEndDate(startOfDay(monthEnd));
        setShowAdjustment(true);
        setRemoveAdjustment(false);
      } else {
        setAdjustmentHours("0");
        setShowAdjustment(false);
      }
    } else if (!userHasEditedHours && !existingAssignment && !existingActualAssignment) {
      // CREATE mode: default to today if same month, otherwise start from 1st of that month
      // But cap today at month end if today is past the month
      const createDefaultStart = isSameMonth(today, monthStart)
        ? (today > monthEnd ? monthEnd : today)
        : monthStart;
      setStartDate(startOfDay(createDefaultStart));
      setEndDate(startOfDay(monthEnd));
      setTotalHours("0"); // Default to 0 in create mode
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingAssignment?.id, existingActualAssignment?.uuid, monthlyTotalHours, planTotalHours, adjustmentTotalHours]);

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

  // Calculate adjustment distribution in real-time
  const adjustmentDistributionResult = useMemo((): DistributionResult => {
    const hours = parseFloat(adjustmentHours.replace(",", "."));

    if (adjustmentStartDate > adjustmentEndDate || isNaN(hours) || hours <= 0) {
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

    return distributeMonthlyHours({
      totalHours: hours,
      monthStart: adjustmentStartDate,
      monthEnd: adjustmentEndDate,
      timeOffAssignments,
    });
  }, [adjustmentHours, adjustmentStartDate, adjustmentEndDate, timeOffAssignments]);

  const hasAdjustmentDistributions = adjustmentDistributionResult.distributions.length > 0;

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

    // Validate actual hours against planned limit
    if (isActual && plannedHoursLimit !== undefined && currentActualHours !== undefined) {
      const validation = validateActualHoursLimit(plannedHoursLimit, currentActualHours, hours);
      if (!validation.isValid) {
        setHoursError("Cannot add more actual hours. Please contact your supervisor.");
        return;
      }
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
      ...(showAdjustment && !removeAdjustment && hasAdjustmentDistributions ? {
        adjustmentHours: parseFloat(adjustmentHours.replace(",", ".")),
        adjustmentStartDate,
        adjustmentEndDate,
        adjustmentDistributions: adjustmentDistributionResult.distributions.map(d => ({
          date: d.date,
          hours: d.hours,
        })),
      } : {}),
      ...(removeAdjustment ? { removeAdjustment: true } : {}),
      planHoursChanged: userHasEditedHours,
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

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[500px] max-h-[75vh] flex flex-col p-0">
        <div className="flex flex-col min-h-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: project.color || "#ccc" }}
              />
              <DialogTitle>{project.name}</DialogTitle>
            </div>
            <DialogDescription>
              {format(monthStart, "MMMM yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-6 space-y-4">
            {/* Mode indicator & employee info */}
            <div>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                isActual
                  ? (isEditMode ? "bg-emerald-100 text-emerald-800" : "bg-green-100 text-green-800")
                  : (isEditMode ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800")
              }`}>
                {isActual
                  ? (isEditMode ? "Edit actual assignment details" : "Create actual assignment")
                  : (isEditMode ? "Edit plan assignment details" : "Create plan assignment")
                }
              </span>
              <div className="mt-2 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">{resource.name}</div>
                <div>{resource.role}</div>
              </div>
            </div>

            {/* Past date warning */}
            {isPastRange && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                <Icon icon="lucide:alert-triangle" className="h-4 w-4 text-amber-600 mt-0.5" />
                <span className="text-xs text-amber-800">
                  Creating assignments for past dates
                </span>
              </div>
            )}

            {/* Date Range Inputs */}
            <div>
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
                    min={format(isEditMode ? monthStart : (isSameMonth(today, monthStart) ? today : monthStart), "yyyy-MM-dd")}
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
            <div>
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
            <div className="p-3 bg-gray-50 rounded-md border">
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
                    <span className={`font-semibold ${isActual ? 'text-green-600' : 'text-blue-600'}`}>{distributionResult.totalHours.toFixed(1)}h</span>
                  </div>
                  {distributionResult.remainingHours > 0 && (
                    <div className="flex justify-between mt-1 pt-1 border-t border-amber-200">
                      <span className="text-amber-700">Remaining (not allocated):</span>
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

            {/* Actual Hours Limit Indicator */}
            {isActual && plannedHoursLimit !== undefined && currentActualHours !== undefined && (
              <div className="p-3 bg-emerald-50 rounded-md border border-emerald-200">
                <div className="text-xs font-semibold text-emerald-700 mb-2">Hours Limit</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-emerald-600">Planned limit:</span>
                    <span className="font-semibold">{plannedHoursLimit.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-600">Already allocated:</span>
                    <span className="font-semibold">{currentActualHours.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-emerald-200">
                    <span className="text-emerald-600">Available:</span>
                    <span className={`font-semibold ${(plannedHoursLimit - currentActualHours) <= 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {Math.max(0, plannedHoursLimit - currentActualHours).toFixed(1)}h
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Adjustment Hours Section - only in plan edit mode for full access users */}
            {!isActual && isEditMode && isFullAccess && (
              <div className="border rounded-md overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
                  onClick={() => {
                    setShowAdjustment(!showAdjustment);
                    if (!showAdjustment) setRemoveAdjustment(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Icon
                      icon={showAdjustment ? "lucide:chevron-down" : "lucide:chevron-right"}
                      className="h-3 w-3"
                    />
                    Adjustment Hours
                  </span>
                  {showAdjustment && !removeAdjustment && parseFloat(adjustmentHours.replace(",", ".")) > 0 && (
                    <span className="text-xs text-blue-600 font-semibold">
                      +{adjustmentHours}h adj
                    </span>
                  )}
                </button>

                {showAdjustment && (
                  <div className="p-3 space-y-3">
                    {/* Date Range for adjustment */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Adjustment Date Range
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Input
                            type="date"
                            value={format(adjustmentStartDate, "yyyy-MM-dd")}
                            onChange={(e) => {
                              const newDate = new Date(e.target.value);
                              setAdjustmentStartDate(startOfDay(newDate));
                            }}
                            className="text-sm"
                            min={format(monthStart, "yyyy-MM-dd")}
                            max={format(monthEnd, "yyyy-MM-dd")}
                          />
                        </div>
                        <span className="text-muted-foreground">to</span>
                        <div className="flex-1">
                          <Input
                            type="date"
                            value={format(adjustmentEndDate, "yyyy-MM-dd")}
                            onChange={(e) => {
                              const newDate = new Date(e.target.value);
                              setAdjustmentEndDate(startOfDay(newDate));
                            }}
                            className="text-sm"
                            min={format(adjustmentStartDate, "yyyy-MM-dd")}
                            max={format(monthEnd, "yyyy-MM-dd")}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Adjustment Hours Input */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Adjustment Hours
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={adjustmentHours}
                          onChange={(e) => {
                            setAdjustmentHours(e.target.value);
                            setUserHasEditedHours(true);
                            setRemoveAdjustment(false);
                          }}
                          className="w-24 text-center"
                          placeholder="0"
                          step="0.5"
                        />
                        <span className="text-xs text-muted-foreground">hours</span>
                      </div>
                    </div>

                    {/* Adjustment Distribution Preview */}
                    {hasAdjustmentDistributions && !removeAdjustment && (
                      <div className="p-2 bg-blue-50 rounded-md border border-blue-100 text-xs">
                        <div className="flex justify-between">
                          <span className="text-blue-700">Distribution:</span>
                          <span className="font-semibold text-blue-700">
                            {adjustmentDistributionResult.hoursPerDay.toFixed(1)}h/day x {adjustmentDistributionResult.totalDays}d
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Total display */}
                    {!removeAdjustment && hasAdjustmentDistributions && (
                      <div className="p-2 bg-gray-100 rounded-md text-xs">
                        <div className="flex justify-between font-semibold">
                          <span>Total:</span>
                          <span>
                            {distributionResult.totalHours.toFixed(1)}h (plan) + {adjustmentDistributionResult.totalHours.toFixed(1)}h (adj) = {(distributionResult.totalHours + adjustmentDistributionResult.totalHours).toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Remove Adjustment button */}
                    {adjustmentAssignments && adjustmentAssignments.length > 0 && (
                      <button
                        type="button"
                        className={`w-full text-xs px-3 py-1.5 rounded border ${
                          removeAdjustment
                            ? 'bg-red-100 border-red-300 text-red-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                        }`}
                        onClick={() => setRemoveAdjustment(!removeAdjustment)}
                      >
                        {removeAdjustment ? 'Adjustment will be removed on save' : 'Remove Adjustment'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Category */}
            <div>
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
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={!isBillable}
                  onCheckedChange={(checked) => setIsBillable(!checked)}
                />
                Non-Billable
              </label>
            </div>

            {/* Note */}
            <details open={noteOpen}>
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
          </div>

          <DialogFooter className="px-6 pb-6 pt-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => onClose()}
              className="text-sm"
            >
              Cancel
            </Button>
            {isEditMode && onDelete && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (isDeleting) return;
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
              onClick={() => handleSave()}
              disabled={!hasDistributions || hoursError !== null || dateError !== null}
              className={`text-sm ${isActual ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
