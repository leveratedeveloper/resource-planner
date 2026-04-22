"use client";

import React, { useState } from "react";
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
import { useProjects } from "@/lib/query/hooks/useProjects";
import { AssignmentCategory } from "@/types";
import { format, differenceInDays } from "date-fns";
import { validateActualHoursLimit } from "@/lib/utils/actual-hours-validation";

interface ActualAssignmentPopoverProps {
  projectId: string;
  startDate: Date;
  endDate: Date;
  onClose: () => void;
  onSave: (assignment: {
    startDate: string;
    endDate: string;
    hoursPerDay: number;
    category: AssignmentCategory;
    isBillable: boolean;
    note?: string;
  }) => void;
  isCreating?: boolean;
  plannedHoursLimit?: number;
  currentActualHours?: number;
}

const CATEGORIES: AssignmentCategory[] = [
  "Research",
  "Development",
  "Design",
  "Meeting",
  "Admin",
  "Other",
];

export const ActualAssignmentPopover: React.FC<ActualAssignmentPopoverProps> = ({
  projectId,
  startDate,
  endDate,
  onClose,
  onSave,
  isCreating = false,
  plannedHoursLimit,
  currentActualHours,
}) => {
  const { data: projects = [] } = useProjects();
  const [hoursInput, setHoursInput] = useState("8");
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [category, setCategory] = useState<AssignmentCategory>("Development");
  const [isBillable, setIsBillable] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const project = projects.find((p) => p.id === projectId);

  const isWeekendSchedule = startDate.getDay() === 0 || startDate.getDay() === 6;
  const dayName = format(startDate, "EEEE");

  const parsedHours = parseFloat(hoursInput.replace(",", "."));
  const durationDays = differenceInDays(endDate, startDate) + 1;
  const totalHours = isNaN(parsedHours) ? 0 : parsedHours * durationDays;

  const handleSave = () => {
    if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      setHoursError("Hours per day must be between 0.5 and 24");
      return;
    }

    // Validate against planned hours limit
    if (plannedHoursLimit !== undefined && currentActualHours !== undefined) {
      const validation = validateActualHoursLimit(plannedHoursLimit, currentActualHours, totalHours);
      if (!validation.isValid) {
        setHoursError("Cannot add more actual hours. Please contact your supervisor.");
        return;
      }
    }

    onSave({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      hoursPerDay: parsedHours,
      category,
      isBillable,
      note: note || undefined,
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-[400px]"
        data-testid="actual-assignment-popover"
      >
        <DialogHeader>
          <DialogTitle>
            {isWeekendSchedule ? (
              <span>{dayName}</span>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: project?.color || "#10b981" }}
                />
                <span>{project?.name || "Actual Assignment"}</span>
                <span className="text-xs text-emerald-600 font-medium">(ACTUAL)</span>
              </div>
            )}
          </DialogTitle>
          <DialogDescription>
            {format(startDate, "MMM d")} - {format(endDate, "MMM d")} ({durationDays} day{durationDays > 1 ? 's' : ''})
          </DialogDescription>
        </DialogHeader>

        {/* Date Range Display */}
        <div className="p-2 bg-muted rounded text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium">{durationDays} day{durationDays > 1 ? 's' : ''}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Range:</span>
            <span className="font-medium">{format(startDate, "MMM d")} - {format(endDate, "MMM d")}</span>
          </div>
        </div>

        {/* Effort Row */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Hours Per Day
          </label>
          <div className="flex items-center gap-2">
            <Input
              data-testid="actual-hours-input"
              type="text"
              inputMode="decimal"
              value={hoursInput}
              onChange={(e) => {
                setHoursInput(e.target.value);
                setHoursError(null);
              }}
              className={`w-20 text-center${hoursError ? " border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            <span className="text-sm text-muted-foreground">h/day</span>
          </div>
          {hoursError && (
            <p className="text-xs text-red-500 mt-1">{hoursError}</p>
          )}
        </div>

        {/* Total Effort Display */}
        <div className="flex items-center justify-between p-2 bg-muted rounded">
          <span className="text-xs text-muted-foreground">Total Effort</span>
          <span className="text-sm font-medium">{totalHours.toFixed(1)}h</span>
        </div>

        {/* Planned Hours Limit Indicator */}
        {plannedHoursLimit !== undefined && currentActualHours !== undefined && (
          <div className="p-2 bg-gray-50 rounded border border-gray-200 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Planned limit:</span>
              <span className="font-medium">{plannedHoursLimit.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Already allocated:</span>
              <span className="font-medium">{currentActualHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-gray-200">
              <span className="text-gray-500">Available:</span>
              <span className={`font-semibold ${(plannedHoursLimit - currentActualHours) <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {Math.max(0, plannedHoursLimit - currentActualHours).toFixed(1)}h
              </span>
            </div>
          </div>
        )}

        {/* Category */}
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: project?.color || "#10b981" }}
            />
            <select
              data-testid="actual-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as AssignmentCategory)}
              className="flex-1 border rounded px-2 py-1.5 text-sm bg-background"
            >
              {CATEGORIES.map((cat) => (
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!isCreating) handleSave();
            }}
            disabled={isCreating}
            data-testid="actual-save-button"
          >
            {isCreating ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
