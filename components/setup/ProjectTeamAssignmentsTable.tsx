"use client";

import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Deliverable } from "@/lib/query/hooks/useDeliverables";

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
  changedDeliverableEmployeeIds: Set<string>;
  selectedDeliverablesByEmployee: Record<string, string[]>;
  projectDeliverables: Deliverable[];
  allDeliverables: Deliverable[];
  canAssignTeam: boolean;
  isDeletePending: boolean;
  onAssignTeam: () => void;
  onUndoDeliverableChange: (employeeId: string) => void;
  onToggleDeliverable: (employeeId: string, deliverableId: string) => void;
  onRemovePending: (employeeId: string) => void;
  onDeleteSavedAssignment: (employeeId: string) => void;
}

export function ProjectTeamAssignmentsTable({
  teamMembers,
  pendingEmployeeIds,
  changedDeliverableEmployeeIds,
  selectedDeliverablesByEmployee,
  projectDeliverables,
  allDeliverables,
  canAssignTeam,
  isDeletePending,
  onAssignTeam,
  onUndoDeliverableChange,
  onToggleDeliverable,
  onRemovePending,
  onDeleteSavedAssignment,
}: ProjectTeamAssignmentsTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left text-sm font-medium p-3 w-[30%]">Name</th>
            <th className="text-left text-sm font-medium p-3 w-[35%]">Deliverables</th>
            <th className="text-left text-sm font-medium p-3 w-[25%]">Critical Allocation</th>
            <th className="text-left text-sm font-medium p-3 w-[10%]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {teamMembers.map((member) => {
            const isPending = pendingEmployeeIds.has(member.id);
            const hasChangedDeliverable = changedDeliverableEmployeeIds.has(member.id);

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
                    {hasChangedDeliverable && !isPending && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-6 w-6 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                        onClick={() => onUndoDeliverableChange(member.id)}
                        title="Undo deliverable change"
                      >
                        <Icon icon="lucide:undo" className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-left font-normal min-h-[32px] h-auto py-1"
                      >
                        {selectedDeliverablesByEmployee[member.id]?.length > 0 ? (
                          <div className="flex flex-col gap-1 w-full">
                            {selectedDeliverablesByEmployee[member.id].map(id => {
                              const deliverable = allDeliverables.find(d => String(d.id) === String(id));
                              return (
                                <Badge key={id} variant="secondary" className="text-sm font-normal px-2 py-0.5 w-fit">
                                  {deliverable?.deliverableNameNew || deliverable?.deliverableName || "Unknown"}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Select deliverables</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {projectDeliverables.length > 0 ? (
                          projectDeliverables.map((deliverable) => {
                            const deliverableId = String(deliverable.id);
                            const isSelected = selectedDeliverablesByEmployee[member.id]?.includes(deliverableId) ?? false;
                            return (
                              <div
                                key={deliverable.id}
                                className="flex items-center space-x-2 p-1.5 hover:bg-accent rounded-md cursor-pointer transition-colors"
                                onClick={(event) => {
                                  event.preventDefault();
                                  onToggleDeliverable(member.id, deliverableId);
                                }}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => {}}
                                />
                                <span className="text-sm select-none">{deliverable.deliverableNameNew || deliverable.deliverableName}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No deliverables available
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
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
                  ) : !hasChangedDeliverable && (
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
              <Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground font-normal" disabled>
                Select deliverable
              </Button>
            </td>
            <td className="p-3 text-sm text-muted-foreground">-</td>
            <td className="p-3"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
