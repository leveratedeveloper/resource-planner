import { Resource, Brand, Assignment } from "@/types";

export const mockResources: Resource[] = [
  { id: "1", name: "Alice Johnson", role: "Designer", department: "Creative", capacity: 40 },
  { id: "2", name: "Bob Smith", role: "Developer", department: "Engineering", capacity: 40 },
  { id: "3", name: "Charlie Brown", role: "Manager", department: "Management", capacity: 40 },
  { id: "4", name: "Diana Prince", role: "Designer", department: "Creative", capacity: 32 },
];

export const mockBrands: Brand[] = [
  { id: "b1", name: "Acme Corp", color: "#3b82f6", resourceIds: ["1", "2"] },
  { id: "b2", name: "Globex", color: "#ef4444", resourceIds: ["2", "3"] },
];

export const mockAssignments: Assignment[] = [
  {
    id: "a1",
    resourceId: "1",
    brandId: "b1",
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 5)),
    hoursPerDay: 4,
  },
];
