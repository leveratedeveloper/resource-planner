"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CriticalMonthlyAllocation } from "@/lib/utils/critical-allocation";

interface ProjectTeamMember {
  id: string;
  fullName: string;
  position: string;
  department: { name: string } | null;
  criticalAllocations: CriticalMonthlyAllocation[];
}

interface ProjectTeamAssignmentsTableProps {
  teamMembers: ProjectTeamMember[];
  pendingEmployeeIds: Set<string>;
  changedManHoursEmployeeIds: Set<string>;
  manHoursByEmployee: Record<string, string>;
  canAssignTeam: boolean;
  isDeletePending: boolean;
  onAssignTeam: () => void;
  onUndoManHoursChange: (employeeId: string) => void;
  onChangeManHours: (employeeId: string, value: string) => void;
  onRemovePending: (employeeId: string) => void;
  onDeleteSavedAssignment: (employeeId: string) => void;
  customizedEmployeeIds: Set<string>;
  onEditMonthly: (employeeId: string) => void;
}

export function ProjectTeamAssignmentsTable({
  teamMembers,
  pendingEmployeeIds,
  changedManHoursEmployeeIds,
  manHoursByEmployee,
  canAssignTeam,
  isDeletePending,
  onAssignTeam,
  onUndoManHoursChange,
  onChangeManHours,
  onRemovePending,
  onDeleteSavedAssignment,
  customizedEmployeeIds,
  onEditMonthly,
}: ProjectTeamAssignmentsTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left text-sm font-medium p-3 w-[35%]">Name</th>
            <th className="text-left text-sm font-medium p-3 w-[20%]">Man Hours</th>
            <th className="text-left text-sm font-medium p-3 w-[30%]">Critical Allocation</th>
            <th className="text-left text-sm font-medium p-3 w-[15%]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {teamMembers.map((member) => {
            const isPending = pendingEmployeeIds.has(member.id);
            const hasChangedManHours = changedManHoursEmployeeIds.has(member.id);

            return (
              <tr key={member.id} className="border-b last:border-b-0">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm">{member.fullName}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member.position}{member.department ? ` • ${member.department.name}` : ""}
                      </div>
                    </div>
                    {hasChangedManHours && !isPending && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-6 w-6 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                        onClick={() => onUndoManHoursChange(member.id)}
                        title="Undo man hours change"
                      >
                        <Icon icon="lucide:undo" className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  {customizedEmployeeIds.has(member.id) ? (
                    <div className="flex h-8 w-24 items-center justify-between rounded-md border border-input bg-muted/40 px-2 text-sm">
                      <span>{manHoursByEmployee[member.id] ?? "0"}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">mo</span>
                    </div>
                  ) : (
                    <Input
                      value={manHoursByEmployee[member.id] ?? ""}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      className="h-8 w-24"
                      onChange={(event) => {
                        const nextValue = event.target.value.replace(/\D/g, "");
                        onChangeManHours(member.id, nextValue);
                      }}
                    />
                  )}
                </td>
                <td className="p-3 text-sm">
                  {member.criticalAllocations.length > 0 ? (
                    <div className="flex flex-col">
                      {member.criticalAllocations.map((allocation) => (
                        <div key={allocation.monthKey} className="font-medium text-red-600">
                          {allocation.monthLabel}: {allocation.percentage}%
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-7 w-7 text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                          onClick={() => onEditMonthly(member.id)}
                          title="Edit monthly hours"
                        >
                          <Icon icon="lucide:pencil" className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit monthly hours</p>
                      </TooltipContent>
                    </Tooltip>
                    {isPending ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onRemovePending(member.id)}
                            title="Remove pending assignment"
                          >
                            <Icon icon="lucide:trash-2" className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Remove pending assignment</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : !hasChangedManHours && (
                      <Popover>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                disabled={isDeletePending}
                              >
                                <Icon icon="lucide:trash-2" className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Remove from project</p>
                          </TooltipContent>
                        </Tooltip>
                        <PopoverContent className="w-auto p-3" align="start">
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Remove {member.fullName} from this project?</p>
                            <div className="flex items-center gap-2 justify-end">
                              <PopoverClose asChild>
                                <Button variant="outline" size="sm">Cancel</Button>
                              </PopoverClose>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => onDeleteSavedAssignment(member.id)}
                                disabled={isDeletePending}
                              >
                                {isDeletePending ? (
                                  <Icon icon="lucide:loader-2" className="h-3.5 w-3.5 animate-spin" />
                                ) : "Remove"}
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          <tr className="border-b last:border-b-0">
            <td className="p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onAssignTeam}
                disabled={!canAssignTeam}
              >
                <Icon icon="lucide:plus" className="h-4 w-4 mr-1" />
                Assign Team
              </Button>
            </td>
            <td className="p-3">
              <Input className="h-8 w-24" placeholder="0" disabled />
            </td>
            <td className="p-3 text-sm text-muted-foreground">-</td>
            <td className="p-3"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
