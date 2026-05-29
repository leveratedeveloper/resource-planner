export type DeliverableChangesInput = {
  teamMembers: Array<{ id: string }>;
  selectedDeliverablesByEmployee: Record<string, string[]>;
  pendingAssignments: Array<{ employeeId: string }>;
  initialDeliverablesByEmployee: Record<string, string[]>;
};

export function getUnsavedDeliverableChanges({
  teamMembers,
  selectedDeliverablesByEmployee,
  pendingAssignments,
  initialDeliverablesByEmployee,
}: DeliverableChangesInput): Array<{ employeeId: string; deliverableIds: string[] }> {
  const changes: Array<{ employeeId: string; deliverableIds: string[] }> = [];

  for (const member of teamMembers) {
    const isPending = pendingAssignments.some((pending) => pending.employeeId === member.id);
    if (isPending) continue;

    const currentDeliverables = selectedDeliverablesByEmployee[member.id] ?? [];
    const initialDeliverables = initialDeliverablesByEmployee[member.id] ?? [];
    if (!sameIds(currentDeliverables, initialDeliverables)) {
      changes.push({ employeeId: member.id, deliverableIds: currentDeliverables });
    }
  }

  return changes;
}

function sameIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}
