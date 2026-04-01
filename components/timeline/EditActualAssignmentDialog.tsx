import { useState, useEffect } from 'react';
import { format, differenceInDays } from 'date-fns';
import type { ActualAssignment } from '@/lib/query/hooks/useActualAssignments';
import { useProjects } from '@/lib/query/hooks/useProjects';
import { useEmployees } from '@/lib/query/hooks/useEmployees';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface EditActualAssignmentDialogProps {
  assignment: ActualAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<ActualAssignment>) => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

const CATEGORIES = [
  'Research',
  'Development',
  'Design',
  'Meeting',
  'Admin',
  'Content',
  'Project Management',
  'Other',
] as const;

export function EditActualAssignmentDialog({
  assignment,
  open,
  onOpenChange,
  onSave,
  onDelete,
  isDeleting = false,
}: EditActualAssignmentDialogProps) {
  const { data: projects } = useProjects();
  const { data: employees } = useEmployees();

  // Use string dates directly to avoid timezone issues
  const [startDateStr, setStartDateStr] = useState(() => assignment.startDate);
  const [endDateStr, setEndDateStr] = useState(() => assignment.endDate);
  const [hoursPerDay, setHoursPerDay] = useState<number | string>(assignment.hoursPerDay);
  const [category, setCategory] = useState(assignment.category || 'Development');
  const [isBillable, setIsBillable] = useState(assignment.isBillable);
  const [note, setNote] = useState(assignment.note || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);

  const project = projects?.find((p) => p.id === assignment.projectUuid);
  const employee = employees?.find((e) => e.id === assignment.employeeUuid);

  // Sync dates when assignment prop changes (after resize/drag)
  useEffect(() => {
    setStartDateStr(assignment.startDate);
    setEndDateStr(assignment.endDate);
  }, [assignment.startDate, assignment.endDate, assignment.uuid]);

  // For display only - convert to Date for formatting
  const startDate = new Date(assignment.startDate);
  const endDate = new Date(assignment.endDate);
  const durationDays = differenceInDays(endDate, startDate) + 1;
  const totalHours = durationDays * (typeof hoursPerDay === 'number' ? hoursPerDay : parseFloat(hoursPerDay));

  const handleSave = () => {
    const parsed = typeof hoursPerDay === 'string' ? parseFloat(hoursPerDay.replace(',', '.')) : hoursPerDay;

    if (isNaN(parsed) || parsed < 0.5 || parsed > 24) {
      setHoursError('Hours must be between 0.5 and 24');
      return;
    }

    if (startDate > endDate) {
      setHoursError('Start date must be before end date');
      return;
    }

    setHoursError(null);
    onSave({
      startDate: startDateStr, // Use synced state date
      endDate: endDateStr, // Use synced state date
      hoursPerDay: parsed,
      category,
      isBillable,
      note: note.trim() || null,
    } as Partial<ActualAssignment>);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[480px] max-h-[90vh] overflow-y-auto"
        data-testid="edit-actual-assignment-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: project?.color || '#10b981' }}
            />
            {project?.name || 'Actual Assignment'}
          </DialogTitle>
          <DialogDescription>
            View and edit actual assignment details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Read-only section */}
          <div className="space-y-3 pb-4 border-b">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Employee</Label>
                <div className="text-sm font-medium">{employee?.fullName || 'Unknown'}</div>
              </div>
              {project && (
                <div>
                  <Label className="text-xs text-muted-foreground">Project</Label>
                  <div className="text-sm font-medium">{project.name}</div>
                </div>
              )}
            </div>
          </div>

          {/* Editable section */}
          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  data-testid="edit-actual-start-date"
                  type="date"
                  value={format(startDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    setHoursError(null);
                    setStartDateStr(e.target.value);
                  }}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  data-testid="edit-actual-end-date"
                  type="date"
                  value={format(endDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    setHoursError(null);
                    setEndDateStr(e.target.value);
                  }}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="hoursPerDay">Hours Per Day</Label>
              <Input
                id="hoursPerDay"
                data-testid="edit-actual-hours-per-day"
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={hoursPerDay}
                onChange={(e) => {
                  setHoursPerDay(parseFloat(e.target.value) || 0);
                  setHoursError(null);
                }}
                className={cn("mt-1.5", hoursError && "border-destructive")}
              />
              {hoursError && (
                <p className="text-sm text-destructive mt-1">{hoursError}</p>
              )}
            </div>

            {/* Effort Summary */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Total Effort</span>
              <span className="text-sm font-medium">{totalHours.toFixed(1)}h ({durationDays} days)</span>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" className="mt-1.5" data-testid="edit-actual-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="billable"
                checked={isBillable}
                onCheckedChange={(checked) => setIsBillable(checked as boolean)}
              />
              <Label
                htmlFor="billable"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Billable
              </Label>
            </div>

            <div>
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                data-testid="edit-actual-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
                className="mt-1.5 min-h-[80px]"
              />
            </div>
          </div>

          {/* Metadata section */}
          <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
            {assignment.createdAt && (
              <div>Created: {format(new Date(assignment.createdAt), 'MMM d, yyyy h:mm a')}</div>
            )}
            {assignment.updatedAt && (
              <div>Updated: {format(new Date(assignment.updatedAt), 'MMM d, yyyy h:mm a')}</div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            data-testid="edit-actual-delete"
          >
            {isDeleting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isDeleting} data-testid="edit-actual-save">
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Actual Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              {project
                ? `Are you sure you want to delete the actual assignment for ${employee?.fullName} on ${project.name}?`
                : `Are you sure you want to delete this actual assignment for ${employee?.fullName}?`}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
              data-testid="edit-actual-delete-confirm"
            >
              {isDeleting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
