"use client";

import React from "react";
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
import { MonthDistributionFields } from "@/components/timeline-v2/editor/MonthDistributionFields";
import { useTimelineEditor } from "@/components/timeline-v2/useTimelineEditor";

type AssignmentEditorProps = {
  canEditAssignments: boolean;
  createdByUuid: string | null;
  isFullAccess: boolean;
};

// The ONE editing surface for the timeline. On the monthly-allocation model
// only MONTH mode is wired: a single "Planned hours" field for the clicked
// month. Create / edit-by-drag modes are out of scope and render a disabled
// notice if reached.
export function AssignmentEditor({ canEditAssignments, createdByUuid }: AssignmentEditorProps) {
  const editor = useTimelineEditor({ canEditAssignments, createdByUuid });
  const target = editor.target;

  if (!target) return null;

  const subtitle =
    target.mode === "month" ? format(target.monthStart, "MMMM yyyy") : "Editing disabled";

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

        {target.mode === "month" ? (
          <MonthDistributionFields
            target={target}
            isSaving={editor.isSavingMonth}
            onSave={editor.saveMonth}
            onDelete={editor.deleteMonth}
            onClose={editor.close}
          />
        ) : (
          <>
            <div className="min-h-0 space-y-2 overflow-y-auto px-6 text-sm text-muted-foreground">
              Inline create / drag editing is disabled. Click a month cell to set planned hours.
            </div>
            <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
              <Button variant="outline" onClick={editor.close} className="text-sm">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
