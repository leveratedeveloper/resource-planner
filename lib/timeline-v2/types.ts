import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { AllocationCellModel } from "@/lib/timeline-v2/allocation-model";
import type { Resource } from "@/types";

export type TimelineViewMode = "week" | "month" | "quarter" | "halfYear" | "year";
export type TimelineResolution = "day" | "month";

export type TimelineColumn = {
  id: string;
  date: Date;
  label: string;
  subLabel: string | null;
  kind: TimelineResolution;
  isWeekend: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
};

export type TimelineColumnSet = {
  viewMode: TimelineViewMode;
  resolution: TimelineResolution;
  startDate: string;
  endDate: string;
  columns: TimelineColumn[];
};

export type TimelineFilters = {
  brandId: string | null;
  department: string | null;
  searchQuery?: string;
  projectId: string | null;
};

export type TimelineResource = Resource & {
  employee: Employee;
};

export type TimelineAllocationCell = {
  id: string;
  employeeId: string;
  date: string;
  model: AllocationCellModel;
};
