import { Resource } from "@/types";
import { AnalysisAssignment, AnalysisProject, AnalysisBrand } from "@/lib/analysis/types";

// Helper to create dates relative to start of current week (for consistency)
const getBaseDate = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Use lazy initialization to avoid SSR/client mismatch
let cachedBaseDate: Date | null = null;
const getConsistentBaseDate = () => {
  if (!cachedBaseDate) {
    cachedBaseDate = getBaseDate();
  }
  return cachedBaseDate;
};

export const mockResources: Resource[] = [
  { id: "1", name: "Alice Johnson", role: "Designer", department: "Creative", capacity: 40 },
  { id: "2", name: "Bob Smith", role: "Developer", department: "Engineering", capacity: 40 },
  { id: "3", name: "Charlie Brown", role: "Manager", department: "Management", capacity: 40 },
  { id: "4", name: "Diana Prince", role: "Designer", department: "Creative", capacity: 32 },
];

export const mockBrands: AnalysisBrand[] = [
  { id: "b1", name: "Acme Corp", color: "#3b82f6", resourceIds: ["1", "2"] },
  { id: "b2", name: "Globex", color: "#ef4444", resourceIds: ["2", "3"] },
];

export const mockProjects: AnalysisProject[] = [
  { id: "p1", name: "Website Redesign", brandId: "b1", color: "#3b82f6", resourceIds: ["1", "2"] },
  { id: "p2", name: "Mobile App v2", brandId: "b1", color: "#10b981", resourceIds: ["2"] },
  { id: "p3", name: "Brand Campaign", brandId: "b2", color: "#ef4444", resourceIds: ["2", "3"] },
  { id: "p4", name: "Q1 Strategy", brandId: "b2", color: "#f59e0b", resourceIds: ["3"] },
];

// Function to generate assignments dynamically (client-side only)
export const createMockAssignments = (): AnalysisAssignment[] => {
  const base = getConsistentBaseDate();
  
  return [
    {
      id: "a1",
      resourceId: "1",
      projectId: "p1",
      startDate: addDays(base, 0),
      endDate: addDays(base, 5),
      hoursPerDay: 4,
      isTimeOff: false,
      category: "Design",
      isBillable: true,
      note: null,
    },
    {
      id: "a2",
      resourceId: "2",
      projectId: "p1",
      startDate: addDays(base, 2),
      endDate: addDays(base, 10),
      hoursPerDay: 6,
      isTimeOff: false,
      category: "Development",
      isBillable: true,
      note: null,
    },
    {
      id: "a3",
      resourceId: "3",
      projectId: "p3",
      startDate: addDays(base, 3),
      endDate: addDays(base, 8),
      hoursPerDay: 8,
      isTimeOff: false,
      category: "Meeting",
      isBillable: false,
      note: null,
    },
    {
      id: "a4",
      resourceId: "4",
      projectId: "p1",
      startDate: addDays(base, 7),
      endDate: addDays(base, 10),
      hoursPerDay: 4,
      isTimeOff: true,
      category: "Other",
      isBillable: false,
      note: "Vacation",
    },
    {
      id: "a5",
      resourceId: "1",
      projectId: "p1",
      startDate: addDays(base, 10),
      endDate: addDays(base, 12),
      hoursPerDay: 8,
      isTimeOff: true,
      category: "Other",
      isBillable: false,
      note: "Personal Day",
    },
    {
      id: "a6",
      resourceId: "2",
      projectId: "p1",
      startDate: addDays(base, 15),
      endDate: addDays(base, 17),
      hoursPerDay: 8,
      isTimeOff: true,
      category: "Other",
      isBillable: false,
      note: "Sick Leave",
    },
  ];
};

// For backwards compatibility, export empty array (will be initialized in context)
export const mockAssignments: AnalysisAssignment[] = [];
