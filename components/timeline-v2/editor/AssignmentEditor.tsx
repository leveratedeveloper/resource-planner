"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MonthDistributionFields } from "@/components/timeline-v2/editor/MonthDistributionFields";
import {
  CategorySelect,
  DeleteWithConfirm,
  NoteField,
  countWeekdays,
} from "@/components/timeline-v2/editor/fields";
import { useTimelineEditor } from "@/components/timeline-v2/useTimelineEditor";
import type { AssignmentEditorTarget } from "@/lib/timeline-v2/editor-store";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { AssignmentCategory } from "@/types";

function CreateFields({
  target,
  onSave,
  onClose,
}: {
  target: Extract<AssignmentEditorTarget, { mode: "create" }>;
  onSave: (data: { hoursPerDay: number; category: AssignmentCategory; isBillable: boolean; note?: string }) => void;
  onClose: () => void;
}) {
  const [hoursInput, setHoursInput] = useState("8");
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [category, setCategory] = useState<AssignmentCategory>("Development");
  const [isBillable, setIsBillable] = useState(true);
  const [note, setNote] = useState("");

  const workDays = countWeekdays(target.startDate, target.endDate);
  const parsedHours = parseFloat(hoursInput.replace(",", "."));
  const totalHours = Number.isNaN(parsedHours) ? 0 : parsedHours * workDays;
  const isWeekendStart = target.startDate.getDay() === 0 || target.startDate.getDay() === 6;

  const handleSave = () => {
    if (Number.isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      setHoursError("Hours per day must be between 0.5 and 24");
      return;
    }
    onSave({ hoursPerDay: parsedHours, category, isBillable, note: note || undefined });
  };

  return (
    <>
      <div className="min-h-0 space-y-4 overflow-y-auto px-6">
        <div className="text-sm text-muted-foreground">
          {format(target.startDate, "EEE, MMM d")} – {format(target.endDate, "EEE, MMM d, yyyy")}
          <span className="ml-2">({workDays} working {workDays === 1 ? "day" : "days"})</span>
        </div>
        {isWeekendStart ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Scheduling starts on a {format(target.startDate, "EEEE")}
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Hours per day</label>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="decimal"
              value={hoursInput}
              onChange={(event) => {
                setHoursInput(event.target.value);
                setHoursError(null);
              }}
              className="w-24 text-center"
            />
            <span className="text-xs text-muted-foreground">
              h/day · {totalHours.toFixed(1)}h total
            </span>
          </div>
          {hoursError ? <p className="mt-1 text-xs text-red-500">{hoursError}</p> : null}
        </div>
        <CategorySelect value={category} onChange={setCategory} color={target.project.color} />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={!isBillable} onCheckedChange={(checked) => setIsBillable(!checked)} />
          Non-Billable
        </label>
        <NoteField value={note} onChange={setNote} />
      </div>
      <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
        <Button variant="outline" onClick={onClose} className="text-sm">
          Cancel
        </Button>
        <Button onClick={handleSave} className="text-sm">
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

function EditFields({
  assignment,
  projectColor,
  onSave,
  onDelete,
  onClose,
}: {
  assignment: Assignment;
  projectColor?: string | null;
  onSave: (updates: Partial<Assignment>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [hoursInput, setHoursInput] = useState(String(assignment.hoursPerDay ?? "8"));
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [category, setCategory] = useState<AssignmentCategory>(
    (assignment.category as AssignmentCategory) || "Development"
  );
  const [isBillable, setIsBillable] = useState(assignment.isBillable ?? true);
  const [status, setStatus] = useState(assignment.status || "draft");
  const [note, setNote] = useState(assignment.note || "");

  const handleSave = () => {
    const parsedHours = parseFloat(hoursInput.replace(",", "."));
    if (Number.isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      setHoursError("Hours per day must be between 0.5 and 24");
      return;
    }
    onSave({
      hoursPerDay: String(parsedHours),
      category,
      isBillable,
      status: status as Assignment["status"],
      note: note || null,
    });
  };

  return (
    <>
      <div className="min-h-0 space-y-4 overflow-y-auto px-6">
        <div className="text-sm text-muted-foreground">
          {format(new Date(`${assignment.startDate}T00:00:00`), "EEE, MMM d")} –{" "}
          {format(new Date(`${assignment.endDate}T00:00:00`), "EEE, MMM d, yyyy")}
          <span className="ml-2 text-xs">(drag the bar to change dates)</span>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Hours per day</label>
          <Input
            type="text"
            inputMode="decimal"
            value={hoursInput}
            onChange={(event) => {
              setHoursInput(event.target.value);
              setHoursError(null);
            }}
            className="w-24 text-center"
          />
          {hoursError ? <p className="mt-1 text-xs text-red-500">{hoursError}</p> : null}
        </div>
        <CategorySelect value={category} onChange={setCategory} color={projectColor} />
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as Assignment["status"])}
            className="w-full rounded border bg-background px-2 py-1.5 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={!isBillable} onCheckedChange={(checked) => setIsBillable(!checked)} />
          Non-Billable
        </label>
        <NoteField value={note} onChange={setNote} />
      </div>
      <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
        <Button variant="outline" onClick={onClose} className="text-sm">
          Cancel
        </Button>
        <DeleteWithConfirm
          description="This deletes the assignment from the plan. This cannot be undone."
          onConfirm={onDelete}
        />
        <Button onClick={handleSave} className="text-sm">
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

type AssignmentEditorProps = {
  canEditAssignments: boolean;
  createdByUuid: string | null;
  isFullAccess: boolean;
};

// The ONE editing surface for the timeline: create, edit, and month-allocation
// modes share this dialog. Saves apply immediately; only destructive deletes
// keep a confirmation step.
export function AssignmentEditor({ canEditAssignments, createdByUuid, isFullAccess }: AssignmentEditorProps) {
  const editor = useTimelineEditor({ canEditAssignments, createdByUuid });
  const target = editor.target;

  if (!target) return null;

  const subtitle =
    target.mode === "month"
      ? format(target.monthStart, "MMMM yyyy")
      : target.mode === "create"
        ? "Create plan assignment"
        : "Edit plan assignment";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) editor.close();
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col p-0 sm:max-w-[480px]" data-testid="assignment-editor">
        <DialogHeader className="shrink-0 px-6 pb-2 pt-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: target.project.color || "#ccc" }} />
            <DialogTitle>{target.project.name}</DialogTitle>
          </div>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {target.mode === "create" ? (
          <CreateFields target={target} onSave={editor.saveCreate} onClose={editor.close} />
        ) : null}
        {target.mode === "edit" ? (
          <EditFields
            assignment={target.assignment}
            projectColor={target.project.color}
            onSave={editor.saveEdit}
            onDelete={editor.deleteSingle}
            onClose={editor.close}
          />
        ) : null}
        {target.mode === "month" && editor.monthContext ? (
          <MonthDistributionFields
            // Remount once the detail query resolves so the form initializers
            // see the loaded edit context, not the empty loading one.
            key={
              editor.monthContext.isLoadingDetail
                ? "loading"
                : editor.monthContext.existingAssignment?.id ?? "create"
            }
            target={target}
            monthContext={editor.monthContext}
            isFullAccess={isFullAccess}
            isSaving={editor.isSavingMonth}
            onSave={editor.saveMonth}
            onDelete={editor.deleteMonth}
            onClose={editor.close}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
