"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";

export interface MonthlyAllocationData {
  projectId: string;
  projectName: string;
  projectColor: string;
  totalHours: number;
  startDate: Date;
  endDate: Date;
  distributions: Array<{ date: Date; hours: number }>;
  category: string;
  isBillable: boolean;
  note?: string;
  adjustmentHours?: number;
  adjustmentStartDate?: Date;
  adjustmentEndDate?: Date;
  removeAdjustment?: boolean;
}

interface MonthlyAllocationConfirmationProps {
  data: MonthlyAllocationData;
  isEditMode: boolean;
  mode?: 'plan' | 'actual';
  onConfirm: () => void;
  onCancel: () => void;
}

export const MonthlyAllocationConfirmation: React.FC<MonthlyAllocationConfirmationProps> = ({
  data,
  isEditMode,
  mode = 'plan',
  onConfirm,
  onCancel,
}) => {
  const isActual = mode === 'actual';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const firstDate = data.distributions[0]?.date;
  const lastDate = data.distributions[data.distributions.length - 1]?.date;

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-[450px] flex flex-col p-0">
        <div className="flex flex-col min-h-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: data.projectColor || "#ccc" }}
              />
              <DialogTitle>
                {isActual
                  ? `${isEditMode ? "Update" : "Create"} Monthly Actual Allocation`
                  : `${isEditMode ? "Update" : "Create"} Monthly Allocation`
                }
              </DialogTitle>
            </div>
            <DialogDescription>
              Review the allocation details before confirming.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-6 space-y-3">
            {/* Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Project:</span>
                <span className="font-medium">{data.projectName}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Selected range:</span>
                <span className="font-medium">
                  {format(data.startDate, "MMM d")} - {format(data.endDate, "MMM d, yyyy")}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Assignments to create:</span>
                <span className="font-semibold">{data.distributions.length}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total hours:</span>
                <span className={`font-semibold ${isActual ? 'text-green-600' : 'text-blue-600'}`}>{data.totalHours.toFixed(1)}h</span>
              </div>

              {(data.adjustmentHours && data.adjustmentHours > 0) || data.removeAdjustment ? (
                <>
                  {data.removeAdjustment && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Adjustment:</span>
                      <span className="font-semibold text-red-600">Removing existing adjustment</span>
                    </div>
                  )}
                  {data.adjustmentHours && data.adjustmentHours > 0 && !data.removeAdjustment && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Adjustment hours:</span>
                        <span className="font-semibold text-blue-500">+{data.adjustmentHours.toFixed(1)}h</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t">
                        <span>Combined total:</span>
                        <span className="text-blue-600">{(data.totalHours + data.adjustmentHours).toFixed(1)}h</span>
                      </div>
                    </>
                  )}
                </>
              ) : null}

              {firstDate && lastDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Distribution dates:</span>
                  <span className="font-medium text-xs">
                    {format(firstDate, "MMM d")} - {format(lastDate, "MMM d")}
                    {firstDate.getTime() !== data.startDate.getTime() ||
                     lastDate.getTime() !== data.endDate.getTime()
                      ? " (weekdays only)"
                      : ""}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium">{data.category}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Billable:</span>
                <span className="font-medium">{data.isBillable ? "Yes" : "No"}</span>
              </div>

              {data.note && (
                <div className="flex items-start justify-between text-sm">
                  <span className="text-muted-foreground">Note:</span>
                  <span className="font-medium text-right max-w-[200px]">{data.note}</span>
                </div>
              )}
            </div>

            {/* Edit mode warning */}
            {isEditMode && (
              <div className={`p-2 rounded-md flex items-start gap-2 ${
                isActual ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
              }`}>
                <Icon icon="lucide:info" className={`h-4 w-4 mt-0.5 ${isActual ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span className={`text-xs ${isActual ? 'text-emerald-800' : 'text-amber-800'}`}>
                  The existing {isActual ? 'actual ' : ''}assignment will be deleted and replaced with {data.distributions.length} new {isActual ? 'actual ' : ''}assignments.
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 pb-6 pt-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => onCancel()}
            >
              Cancel
            </Button>
            <Button
              onClick={() => onConfirm()}
              className={isActual ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Confirm
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
