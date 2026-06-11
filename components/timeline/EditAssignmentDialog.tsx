import { useState } from 'react';
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

  const [hoursInput, setHoursInput] = useState(assignment.hoursPerDay ?? "8");
  const [category, setCategory] = useState(assignment.category || 'Development');
  const [isBillable, setIsBillable] = useState(assignment.isBillable ?? true);
  const [status, setStatus] = useState(assignment.status || 'draft');
  const [note, setNote] = useState(assignment.note || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);

  const project = projects?.find((p) => p.id === assignment.projectId);
  const employee = employees?.find((e) => e.id === assignment.employeeId);
  const createdBy = employees?.find((e) => e.id === assignment.createdById);

  // For display only - convert to Date for formatting
  const startDate = new Date(assignment.startDate);
  const endDate = new Date(assignment.endDate);
  const duration = differenceInDays(endDate, startDate) + 1; // +1 to include both start and end days

  const handleSave = () => {
    // Normalize comma to dot for parseFloat (supports both "0.5" and "0,5" formats)
    const normalizedInput = hoursInput.replace(',', '.');
    const parsed = parseFloat(normalizedInput);

    // FIXED: Use < 0.5 to match min="0.5" attribute and error message
    if (hoursInput.trim() === '' || isNaN(parsed) || parsed < 0.5 || parsed > 24) {
      setHoursError('Hours per day must be between 0.5 and 24');
      return;
    }

    setHoursError(null);
    onSave({
      employeeId: assignment.employeeId,
      projectId: assignment.projectId,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      hoursPerDay: parsed.toString(),
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
      <DialogContent
        className="max-w-[480px] max-h-[75vh] flex flex-col p-0"
        data-testid="edit-assignment-dialog"
      >
        <div className="flex flex-col min-h-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: project?.color || '#94a3b8' }}
              />
              <div className="flex flex-col">
                <span>{project?.name || 'Unknown Project'}</span>
                <span className="text-sm font-normal text-muted-foreground">{employee?.fullName || 'Unknown'}</span>
              </div>
            </DialogTitle>
            <DialogDescription>
              Edit plan assignment details
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-6 space-y-6">
          {/* Read-only section */}
          <div className="space-y-3 pb-4 border-b">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Employee</Label>
                <div className="text-sm font-medium">{employee?.fullName || 'Unknown'}</div>
                <div className="text-xs font-medium">{employee?.position || '—'}</div>
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
                data-testid="edit-assignment-hours"
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={hoursInput}
                onChange={(e) => {
                  setHoursInput(e.target.value);
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
                <SelectTrigger id="category" className="mt-1.5" data-testid="edit-assignment-category">
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
                <SelectTrigger id="status" className="mt-1.5" data-testid="edit-assignment-status">
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
                data-testid="edit-assignment-note"
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

        <DialogFooter className="px-6 pb-6 pt-2">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            data-testid="edit-assignment-delete"
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
            <Button onClick={handleSave} disabled={isDeleting} data-testid="edit-assignment-save">
              Save
            </Button>
          </div>
        </DialogFooter>
        </div>
      </DialogContent>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              {project
                ? `Are you sure you want to delete the assignment for ${employee?.fullName} on ${project.name}?`
                : `Are you sure you want to delete this assignment for ${employee?.fullName}?`}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
              data-testid="edit-assignment-delete-confirm"
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
