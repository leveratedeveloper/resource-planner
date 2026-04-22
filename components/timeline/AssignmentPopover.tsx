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
import { useEmployees } from "@/lib/query/hooks/useEmployees";
import { useProjects } from "@/lib/query/hooks/useProjects";
import { AssignmentCategory } from "@/types";
import { format, differenceInDays } from "date-fns";

// Count weekdays (Mon–Fri) between two dates, inclusive. Returns at least 1.
function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return Math.max(1, count);
}

interface AssignmentPopoverProps {
  resourceId: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
  onClose: () => void;
  onSave: (assignment: {
    hoursPerDay: number;
    workDays: number;
    category: AssignmentCategory;
    isBillable: boolean;
    note?: string;
  }) => void;
  isCreating?: boolean;
}

export const AssignmentPopover: React.FC<AssignmentPopoverProps> = ({
  resourceId,
  projectId,
  startDate,
  endDate,
  onClose,
  onSave,
  isCreating = false,
}) => {
  const { data: employees = [] } = useEmployees();
  const { data: projects = [] } = useProjects();
  const [hoursInput, setHoursInput] = useState("8");
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [workDays, setWorkDays] = useState(() => countWeekdays(startDate, endDate));
  const [category, setCategory] = useState<AssignmentCategory>("Development");
  const [isBillable, setIsBillable] = useState(true);
  const [repeat, setRepeat] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const resource = employees.find((r) => r.id === resourceId);
  const project = projects.find((p) => p.id === projectId);

  // Check if scheduling on a weekend
  const isWeekendSchedule = startDate.getDay() === 0 || startDate.getDay() === 6;
  const dayName = format(startDate, "EEEE"); // e.g., "Saturday"

  // Parse hours — normalize comma decimal separator (e.g. "0,5" → 0.5)
  const parsedHours = parseFloat(hoursInput.replace(",", "."));

  // Calculate total effort (guard against NaN)
  const totalHours = isNaN(parsedHours) ? 0 : parsedHours * workDays;

  const handleSave = () => {
    if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      setHoursError("Hours per day must be between 0.5 and 24");
      return;
    }
    onSave({
      hoursPerDay: parsedHours,
      workDays,
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

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-[400px]"
        data-testid="assignment-popover"
      >
        <DialogHeader>
          <DialogTitle>
            {isWeekendSchedule ? (
              <span>{dayName}</span>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: project?.color || "#ccc" }}
                />
                <span>{project?.name || "Assignment"}</span>
              </div>
            )}
          </DialogTitle>
          <DialogDescription>
            {format(startDate, "MMM d")}
            {differenceInDays(endDate, startDate) > 0 && ` - ${format(endDate, "MMM d")}`}
          </DialogDescription>
        </DialogHeader>

        {/* Effort Row */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">
              Effort
            </label>
            <div className="flex items-center gap-1">
              <Input
                data-testid="assignment-hours-input"
                type="text"
                inputMode="decimal"
                value={hoursInput}
                onChange={(e) => {
                  setHoursInput(e.target.value);
                  setHoursError(null);
                }}
                className={`w-16 text-center${hoursError ? " border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              <span className="text-xs text-muted-foreground">h/d</span>
            </div>
            {hoursError && (
              <p className="text-xs text-red-500 mt-1">{hoursError}</p>
            )}
          </div>

          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">
              Work Days
            </label>
            <div className="flex items-center gap-1">
              <Input
                data-testid="assignment-workdays-input"
                type="number"
                value={workDays}
                onChange={(e) => setWorkDays(Number(e.target.value))}
                className="w-16 text-center"
                min={1}
              />
              <div className="flex flex-col">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setWorkDays((w) => w + 1)}
                  aria-label="Increase work days"
                >
                  <Icon icon="lucide:chevron-up" className="h-3 w-3" />
                </button>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setWorkDays((w) => Math.max(1, w - 1))}
                  aria-label="Decrease work days"
                >
                  <Icon icon="lucide:chevron-down" className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">
              Total Effort
            </label>
            <div className="flex items-center gap-1">
              <Input
                value={`${totalHours.toFixed(1)}`}
                className="w-20 text-center bg-muted"
                readOnly
              />
              <span className="text-xs text-muted-foreground">Hours</span>
            </div>
          </div>
        </div>

        {/* Category */}
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: project?.color || "#ccc" }}
            />
            <select
              data-testid="assignment-category-select"
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
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={repeat}
              onCheckedChange={(checked) => setRepeat(checked as boolean)}
            />
            Repeat
          </label>
        </div>

        {/* Note - Using native details/summary */}
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
            data-testid="assignment-save-button"
          >
            {isCreating ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Creating...
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
