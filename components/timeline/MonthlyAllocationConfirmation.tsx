"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
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
}

interface MonthlyAllocationConfirmationProps {
  data: MonthlyAllocationData;
  isEditMode: boolean;
  mode?: 'plan' | 'actual';
  position: { x: number; y: number };
  onConfirm: () => void;
  onCancel: () => void;
}

export const MonthlyAllocationConfirmation: React.FC<MonthlyAllocationConfirmationProps> = ({
  data,
  isEditMode,
  mode = 'plan',
  position,
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

  return createPortal(
    <div
      className="fixed z-[10000] bg-white rounded-lg shadow-xl border p-4 min-w-[400px] max-w-[450px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 470),
        top: Math.min(position.y, window.innerHeight - 400),
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: data.projectColor || "#ccc" }}
        />
        <h3 className="font-semibold text-sm">
          {isActual
            ? `${isEditMode ? "Update" : "Create"} Monthly Actual Allocation`
            : `${isEditMode ? "Update" : "Create"} Monthly Allocation`
          }
        </h3>
      </div>

      {/* Summary */}
      <div className="space-y-3 mb-4">
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
        <div className={`mb-4 p-2 rounded-md flex items-start gap-2 ${
          isActual ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
        }`}>
          <Icon icon="lucide:info" className={`h-4 w-4 mt-0.5 ${isActual ? 'text-emerald-600' : 'text-amber-600'}`} />
          <span className={`text-xs ${isActual ? 'text-emerald-800' : 'text-amber-800'}`}>
            The existing {isActual ? 'actual ' : ''}assignment will be deleted and replaced with {data.distributions.length} new {isActual ? 'actual ' : ''}assignments.
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t">
        <Button
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
          className={isActual ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          Confirm
        </Button>
      </div>
    </div>,
    document.body
  );
};
