"use client";

import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { format, isSameMonth, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { distributeMonthlyHours, type DistributionResult } from "@/lib/utils/allocation-distributor";
import type { AssignmentEditorTarget } from "@/lib/timeline-v2/editor-store";
import type { MonthSaveData } from "@/components/timeline-v2/useTimelineEditor";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { AssignmentCategory } from "@/types";
import { CategorySelect, DeleteWithConfirm, NoteField } from "@/components/timeline-v2/editor/fields";

const EMPTY_DISTRIBUTION: DistributionResult = {
  distributions: [],
  totalDays: 0,
  totalHours: 0,
  hoursPerDay: 0,
  skippedDays: 0,
  remainingHours: 0,
  blockedDays: { weekend: 0 },
};

type MonthContext = {
  detailAssignments: Assignment[];
  existingAssignment?: Assignment;
  adjustmentAssignments: Assignment[];
  isLoadingDetail: boolean;
};

type MonthDistributionFieldsProps = {
  target: Extract<AssignmentEditorTarget, { mode: "month" }>;
  monthContext: MonthContext;
  isFullAccess: boolean;
  isSaving: boolean;
  onSave: (data: MonthSaveData) => void;
  onDelete: () => void;
  onClose: () => void;
};

// Month-allocation body of the unified editor — ported from the legacy
// MonthlyAllocationModal (minus the confirmation step and the dead actual-mode
// branches). Total hours spread across working days in the selected range;
// full-access users can layer adjustment hours on top in edit mode.
export function MonthDistributionFields({
  target,
  monthContext,
  isFullAccess,
  isSaving,
  onSave,
  onDelete,
  onClose,
}: MonthDistributionFieldsProps) {
  const today = startOfDay(new Date());
  const isEditMode = !!monthContext.existingAssignment;

  // Edit mode starts from today when editing the current month (past days keep
  // their saved hours); create mode likewise. Mirrors the legacy modal.
  const defaultStart = isSameMonth(today, target.monthStart)
    ? today > target.monthEnd
      ? target.monthEnd
      : today
    : target.monthStart;

  const [totalHours, setTotalHours] = useState(() =>
    isEditMode ? String(target.planTotalHours ?? 0) : "0"
  );
  const [userHasEditedHours, setUserHasEditedHours] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => startOfDay(defaultStart));
  const [endDate, setEndDate] = useState(() => startOfDay(target.monthEnd));
  const [dateError, setDateError] = useState<string | null>(null);
  const [category, setCategory] = useState<AssignmentCategory>(
    (monthContext.existingAssignment?.category as AssignmentCategory) || "Development"
  );
  const [isBillable, setIsBillable] = useState(monthContext.existingAssignment?.isBillable ?? true);
  const [note, setNote] = useState("");

  const hasInitialAdjustment = !!target.adjustmentTotalHours && target.adjustmentTotalHours > 0;
  const [adjustmentHours, setAdjustmentHours] = useState(() =>
    hasInitialAdjustment ? String(target.adjustmentTotalHours) : "0"
  );
  const [adjustmentStartDate, setAdjustmentStartDate] = useState(() => startOfDay(target.monthStart));
  const [adjustmentEndDate, setAdjustmentEndDate] = useState(() => startOfDay(target.monthEnd));
  const [showAdjustment, setShowAdjustment] = useState(hasInitialAdjustment);
  const [removeAdjustment, setRemoveAdjustment] = useState(false);

  const distributionResult = useMemo((): DistributionResult => {
    const hours = parseFloat(totalHours.replace(",", "."));
    if (startDate > endDate || Number.isNaN(hours) || hours <= 0) return EMPTY_DISTRIBUTION;
    return distributeMonthlyHours({ totalHours: hours, monthStart: startDate, monthEnd: endDate });
  }, [endDate, startDate, totalHours]);

  const adjustmentDistributionResult = useMemo((): DistributionResult => {
    const hours = parseFloat(adjustmentHours.replace(",", "."));
    if (adjustmentStartDate > adjustmentEndDate || Number.isNaN(hours) || hours <= 0) {
      return EMPTY_DISTRIBUTION;
    }
    return distributeMonthlyHours({
      totalHours: hours,
      monthStart: adjustmentStartDate,
      monthEnd: adjustmentEndDate,
    });
  }, [adjustmentEndDate, adjustmentHours, adjustmentStartDate]);

  const hasDistributions = distributionResult.distributions.length > 0;
  const hasAdjustmentDistributions = adjustmentDistributionResult.distributions.length > 0;
  const isPastRange = endDate <= today;

  const handleSave = () => {
    const hours = parseFloat(totalHours.replace(",", "."));
    if (Number.isNaN(hours) || hours <= 0) {
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
      totalHours: hours,
      startDate,
      endDate,
      distributions: distributionResult.distributions.map((d) => ({ date: d.date, hours: d.hours })),
      category,
      isBillable,
      note: note || undefined,
      ...(showAdjustment && !removeAdjustment && hasAdjustmentDistributions
        ? {
            adjustmentStartDate,
            adjustmentEndDate,
            adjustmentDistributions: adjustmentDistributionResult.distributions.map((d) => ({
              date: d.date,
              hours: d.hours,
            })),
          }
        : {}),
      ...(removeAdjustment ? { removeAdjustment: true } : {}),
      planHoursChanged: userHasEditedHours,
    });
  };

  if (monthContext.isLoadingDetail) {
    return (
      <div className="space-y-3 px-6 pb-6">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-0 space-y-4 overflow-y-auto px-6">
        <span
          className={`rounded px-2 py-1 text-xs font-semibold ${
            isEditMode ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
          }`}
        >
          {isEditMode ? "Edit plan assignment details" : "Create plan assignment"}
        </span>

        {isPastRange ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2">
            <Icon icon="lucide:alert-triangle" className="mt-0.5 h-4 w-4 text-amber-600" />
            <span className="text-xs text-amber-800">Creating assignments for past dates</span>
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Date Range</label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                type="date"
                value={format(startDate, "yyyy-MM-dd")}
                onChange={(event) => {
                  setStartDate(startOfDay(new Date(event.target.value)));
                  setDateError(null);
                }}
                className="text-sm"
                min={format(isEditMode ? target.monthStart : defaultStart, "yyyy-MM-dd")}
                max={format(target.monthEnd, "yyyy-MM-dd")}
              />
            </div>
            <span className="text-muted-foreground">to</span>
            <div className="flex-1">
              <Input
                type="date"
                value={format(endDate, "yyyy-MM-dd")}
                onChange={(event) => {
                  setEndDate(startOfDay(new Date(event.target.value)));
                  setDateError(null);
                }}
                className="text-sm"
                min={format(startDate, "yyyy-MM-dd")}
                max={format(target.monthEnd, "yyyy-MM-dd")}
              />
            </div>
          </div>
          {dateError ? <p className="mt-1 text-xs text-red-500">{dateError}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Total Hours</label>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="decimal"
              value={totalHours}
              onChange={(event) => {
                setTotalHours(event.target.value);
                setHoursError(null);
                setUserHasEditedHours(true);
              }}
              className={`w-24 text-center${hoursError ? " border-red-500 focus-visible:ring-red-500" : ""}`}
              placeholder="0"
            />
            <span className="text-xs text-muted-foreground">hours</span>
          </div>
          {hoursError ? <p className="mt-1 text-xs text-red-500">{hoursError}</p> : null}
        </div>

        <div className="rounded-md border bg-muted/40 p-3">
          <div className="mb-2 text-xs font-semibold">
            Distribution: {format(startDate, "MMM d")} – {format(endDate, "MMM d, yyyy")}
          </div>
          {!hasDistributions ? (
            <div className="text-xs text-muted-foreground">
              {distributionResult.totalDays === 0
                ? "No working days available in selected date range"
                : "Enter hours to see distribution"}
            </div>
          ) : (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Working days:</span>
                <span className="font-semibold">{distributionResult.totalDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hours per day:</span>
                <span className="font-semibold">{distributionResult.hoursPerDay.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total to allocate:</span>
                <span className="font-semibold text-blue-600">{distributionResult.totalHours.toFixed(1)}h</span>
              </div>
              {distributionResult.remainingHours > 0 ? (
                <div className="mt-1 flex justify-between border-t border-amber-200 pt-1">
                  <span className="text-amber-700">Remaining (not allocated):</span>
                  <span className="font-semibold text-amber-700">
                    {distributionResult.remainingHours.toFixed(1)}h
                  </span>
                </div>
              ) : null}
              {distributionResult.blockedDays.weekend > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Skipped weekends:</span>
                  <span>{distributionResult.blockedDays.weekend}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {isEditMode && isFullAccess ? (
          <div className="overflow-hidden rounded-md border">
            <button
              type="button"
              className="flex w-full items-center justify-between bg-muted/40 px-3 py-2 text-sm font-medium hover:bg-muted/60"
              onClick={() => {
                setShowAdjustment(!showAdjustment);
                if (!showAdjustment) setRemoveAdjustment(false);
              }}
            >
              <span className="flex items-center gap-2">
                <Icon icon={showAdjustment ? "lucide:chevron-down" : "lucide:chevron-right"} className="h-3 w-3" />
                Adjustment Hours
              </span>
              {showAdjustment && !removeAdjustment && parseFloat(adjustmentHours.replace(",", ".")) > 0 ? (
                <span className="text-xs font-semibold text-blue-600">+{adjustmentHours}h adj</span>
              ) : null}
            </button>

            {showAdjustment ? (
              <div className="space-y-3 p-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Adjustment Date Range</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        type="date"
                        value={format(adjustmentStartDate, "yyyy-MM-dd")}
                        onChange={(event) => setAdjustmentStartDate(startOfDay(new Date(event.target.value)))}
                        className="text-sm"
                        min={format(target.monthStart, "yyyy-MM-dd")}
                        max={format(target.monthEnd, "yyyy-MM-dd")}
                      />
                    </div>
                    <span className="text-muted-foreground">to</span>
                    <div className="flex-1">
                      <Input
                        type="date"
                        value={format(adjustmentEndDate, "yyyy-MM-dd")}
                        onChange={(event) => setAdjustmentEndDate(startOfDay(new Date(event.target.value)))}
                        className="text-sm"
                        min={format(adjustmentStartDate, "yyyy-MM-dd")}
                        max={format(target.monthEnd, "yyyy-MM-dd")}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Adjustment Hours</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={adjustmentHours}
                      onChange={(event) => {
                        setAdjustmentHours(event.target.value);
                        setUserHasEditedHours(true);
                        setRemoveAdjustment(false);
                      }}
                      className="w-24 text-center"
                      placeholder="0"
                    />
                    <span className="text-xs text-muted-foreground">hours</span>
                  </div>
                </div>

                {hasAdjustmentDistributions && !removeAdjustment ? (
                  <div className="rounded-md border border-blue-100 bg-blue-50 p-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Distribution:</span>
                      <span className="font-semibold text-blue-700">
                        {adjustmentDistributionResult.hoursPerDay.toFixed(1)}h/day x{" "}
                        {adjustmentDistributionResult.totalDays}d
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>
                        {distributionResult.totalHours.toFixed(1)}h (plan) +{" "}
                        {adjustmentDistributionResult.totalHours.toFixed(1)}h (adj) ={" "}
                        {(distributionResult.totalHours + adjustmentDistributionResult.totalHours).toFixed(1)}h
                      </span>
                    </div>
                  </div>
                ) : null}

                {monthContext.adjustmentAssignments.length > 0 ? (
                  <button
                    type="button"
                    className={`w-full rounded border px-3 py-1.5 text-xs ${
                      removeAdjustment
                        ? "border-red-300 bg-red-100 text-red-700"
                        : "border-input bg-background text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    }`}
                    onClick={() => setRemoveAdjustment(!removeAdjustment)}
                  >
                    {removeAdjustment ? "Adjustment will be removed on save" : "Remove Adjustment"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <CategorySelect value={category} onChange={setCategory} color={target.project.color} />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={!isBillable} onCheckedChange={(checked) => setIsBillable(!checked)} />
          Non-Billable
        </label>
        <NoteField value={note} onChange={setNote} />
      </div>

      <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
        <Button variant="outline" onClick={onClose} className="text-sm" disabled={isSaving}>
          Cancel
        </Button>
        {isEditMode ? (
          <DeleteWithConfirm
            description={`This deletes every ${target.project.name} assignment in ${format(target.monthStart, "MMMM yyyy")} for this person. This cannot be undone.`}
            disabled={isSaving}
            onConfirm={onDelete}
          />
        ) : null}
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasDistributions || hoursError !== null || dateError !== null}
          className="text-sm"
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
