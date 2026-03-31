"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom"; // 1. IMPORT CREATE PORTAL DI SINI
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useProjects } from "@/lib/query/hooks/useProjects";
import { AssignmentCategory } from "@/types";
import { format, differenceInDays } from "date-fns";

interface ActualAssignmentPopoverProps {
  projectId: string;
  startDate: Date;
  endDate: Date;
  position: { x: number; y: number };
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
  position,
  onClose,
  onSave,
  isCreating = false,
}) => {
  const { data: projects = [] } = useProjects();
  const [hoursInput, setHoursInput] = useState("8");
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [category, setCategory] = useState<AssignmentCategory>("Development");
  const [isBillable, setIsBillable] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  // 2. STATE UNTUK MENCEGAH NEXT.JS HYDRATION ERROR
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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
    onSave({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      hoursPerDay: parsedHours,
      category,
      isBillable,
      note: note || undefined,
    });
  };

  // Tunggu sampai komponen mounted di browser sebelum membuat Portal
  if (!mounted) return null;

  // 3. GUNAKAN CREATE PORTAL
  return createPortal(
    <div
      // Ubah z-index menjadi ekstrim (9999) agar tidak ada yang bisa menutupi
      className="fixed z-[9999] bg-white rounded-lg shadow-xl border p-4 min-w-[320px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 360),
        top: Math.min(position.y, window.innerHeight - 400),
      }}
      data-testid="actual-assignment-popover"
      // Menahan klik agar tidak tembus ke belakang
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isWeekendSchedule ? (
            <span className="font-medium text-sm">{dayName}</span>
          ) : (
            <>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: project?.color || "#10b981" }}
              />
              <span className="font-medium text-sm">{project?.name || "Actual Assignment"}</span>
              <span className="text-xs text-emerald-600 font-medium">(ACTUAL)</span>
            </>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close popover"
        >
          <Icon icon="lucide:x" className="h-4 w-4" />
        </button>
      </div>

      {/* Date Range Display */}
      <div className="mb-3 p-2 bg-muted rounded text-sm">
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
      <div className="mb-4">
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
      <div className="flex items-center justify-between p-2 bg-muted rounded mb-4">
        <span className="text-xs text-muted-foreground">Total Effort</span>
        <span className="text-sm font-medium">{totalHours.toFixed(1)}h</span>
      </div>

      {/* Category */}
      <div className="mb-4">
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
      <div className="flex items-center justify-between pt-3 border-t mt-4">
        {/* KARENA SUDAH DI PORTAL, KITA BISA KEMBALI MENGGUNAKAN onClick */}
        <Button
          variant="link"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-sm px-0"
          disabled={isCreating}
        >
          Cancel
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation();
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
      </div>
    </div>,
    document.body // <-- DIREnder DI LUAR KALENDER
  );
};