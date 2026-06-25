"use client";

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { parseManHoursInput, splitTotalAcrossMonthsMap, toWholeHoursInput } from "@/lib/assignments/split";

type EditMonthlyAllocationDialogProps = {
  open: boolean;
  memberName: string;
  projectName: string;
  /** "yyyy-MM-01" month keys for the project span, in order. */
  months: string[];
  /** Current per-month hours for this member. Missing months default to 0. */
  initialMonthly: Record<string, number>;
  onSave: (monthly: Record<string, number>) => void;
  onClose: () => void;
};

export function EditMonthlyAllocationDialog({
  open,
  memberName,
  projectName,
  months,
  initialMonthly,
  onSave,
  onClose,
}: EditMonthlyAllocationDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(months.map((m) => [m, String(Math.round(initialMonthly[m] ?? 0))])),
  );

  const total = useMemo(
    () => months.reduce((sum, m) => sum + (parseManHoursInput(values[m]) ?? 0), 0),
    [months, values],
  );

  const distributeEvenly = () => {
    const even = splitTotalAcrossMonthsMap(total, months[0], months[months.length - 1]);
    setValues(Object.fromEntries(months.map((m) => [m, String(Math.round(even[m] ?? 0))])));
  };

  const handleSave = () => {
    onSave(Object.fromEntries(months.map((m) => [m, parseManHoursInput(values[m]) ?? 0])));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="flex max-h-[80vh] flex-col p-0 sm:max-w-[440px]" data-testid="edit-monthly-dialog">
        <DialogHeader className="shrink-0 px-6 pb-2 pt-6">
          <DialogTitle>Monthly hours — {memberName}</DialogTitle>
          <DialogDescription>{projectName}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto px-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">{total}</span>{" "}
              <span className="text-xs text-muted-foreground">total hours (sum of months)</span>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:underline"
              onClick={distributeEvenly}
              data-testid="edit-monthly-distribute-evenly"
            >
              Distribute evenly
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {months.map((month) => (
              <div key={month}>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  {format(new Date(`${month}T00:00:00`), "MMM yyyy")}
                </label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={values[month] ?? ""}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [month]: toWholeHoursInput(event.target.value) }))
                  }
                  placeholder="0"
                  className="h-9 text-center"
                  data-testid={`edit-monthly-input-${month}`}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
          <Button variant="outline" onClick={onClose} className="text-sm">Cancel</Button>
          <Button onClick={handleSave} className="text-sm" data-testid="edit-monthly-save">Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
