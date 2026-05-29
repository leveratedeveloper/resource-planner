import { describe, expect, it } from "vitest";
import { getUnsavedDeliverableChanges } from "@/components/setup/project-setup/deliverable-selection";

describe("project setup deliverable selection", () => {
  it("returns changes only for non-pending members with changed selection", () => {
    const result = getUnsavedDeliverableChanges({
      teamMembers: [{ id: "emp-1" }, { id: "emp-2" }, { id: "emp-3" }],
      selectedDeliverablesByEmployee: {
        "emp-1": ["del-1", "del-2"],
        "emp-2": ["del-3"],
      },
      pendingAssignments: [{ employeeId: "emp-3" }],
      initialDeliverablesByEmployee: {
        "emp-1": ["del-2", "del-1"],
        "emp-2": ["del-4"],
      },
    });

    expect(result).toEqual([{ employeeId: "emp-2", deliverableIds: ["del-3"] }]);
  });
});
