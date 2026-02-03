import { useState, useEffect } from 'react';
import { format, differenceInDays } from 'date-fns';
import type { Assignment } from '@/lib/query/hooks/useAssignments';
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

interface EditAssignmentDialogProps {
  assignment: Assignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Assignment>) => void;
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

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
] as const;

export function EditAssignmentDialog({
  assignment,
  open,
  onOpenChange,
  onSave,
  onDelete,
  isDeleting = false,
}: EditAssignmentDialogProps) {
  const { data: projects } = useProjects();
  const { data: employees } = useEmployees();

  const [hoursPerDay, setHoursPerDay] = useState(parseFloat(assignment.hoursPerDay) || 8);
  const [category, setCategory] = useState(assignment.category || 'Development');
  const [isBillable, setIsBillable] = useState(assignment.isBillable ?? true);
  const [status, setStatus] = useState(assignment.status || 'draft');
  const [note, setNote] = useState(assignment.note || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);

  // Reset form when assignment changes
  useEffect(() => {
    setHoursPerDay(parseFloat(assignment.hoursPerDay) || 8);
    setCategory(assignment.category || 'Development');
    setIsBillable(assignment.isBillable ?? true);
    setStatus(assignment.status || 'draft');
    setNote(assignment.note || '');
  }, [assignment]);

  const project = projects?.find((p) => p.id === assignment.projectId);
  const employee = employees?.find((e) => e.id === assignment.employeeId);
  const createdBy = employees?.find((e) => e.id === assignment.createdById);

  const startDate = new Date(assignment.startDate);
  const endDate = new Date(assignment.endDate);
  const duration = differenceInDays(endDate, startDate) + 1; // +1 to include both start and end days

  const handleSave = () => {
    if (hoursPerDay <= 0 || hoursPerDay > 24) {
      setHoursError('Hours per day must be between 0.5 and 24');
      return;
    }

    setHoursError(null);
    onSave({
      hoursPerDay: hoursPerDay.toString(),
      category,
      isBillable,
      status,
      note: note.trim() || null,
    } as Partial<Assignment>);
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
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: project?.color || '#94a3b8' }}
            />
            {project?.name || 'Time Off'}
          </DialogTitle>
          <DialogDescription>
            View and edit assignment details
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <div className="text-sm">{format(startDate, 'MMM d, yyyy')}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <div className="text-sm">{format(endDate, 'MMM d, yyyy')}</div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Duration</Label>
              <div className="text-sm">{duration} {duration === 1 ? 'day' : 'days'}</div>
            </div>
          </div>

          {/* Editable section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="hoursPerDay">Hours per Day</Label>
              <Input
                id="hoursPerDay"
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={hoursPerDay}
                onChange={(e) => {
                  setHoursPerDay(parseFloat(e.target.value));
                  setHoursError(null);
                }}
                className={cn("mt-1.5", hoursError && "border-destructive")}
              />
              {hoursError && (
                <p className="text-sm text-destructive mt-1">{hoursError}</p>
              )}
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" className="mt-1.5">
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

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger id="status" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
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
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
                className="mt-1.5 min-h-[80px]"
              />
            </div>
          </div>

          {/* Metadata section */}
          <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
            {createdBy && (
              <div>Created by: {createdBy.fullName}</div>
            )}
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
            <Button onClick={handleSave} disabled={isDeleting}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              {project
                ? `Are you sure you want to delete the assignment for ${employee?.fullName} on ${project.name}?`
                : `Are you sure you want to delete the time-off for ${employee?.fullName}?`}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
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
