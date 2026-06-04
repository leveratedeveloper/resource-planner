import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import type { Resource } from "@/types";

export type TimelineV2ViewMode = "week" | "month" | "quarter" | "halfYear" | "year";
export type TimelineV2Resolution = "day" | "month";
export type TimelineV2LaneKind = "allocation" | "timeOff" | "plan" | "actual";

export type TimelineV2Column = {
  id: string;
  date: Date;
  label: string;
  subLabel: string | null;
  kind: TimelineV2Resolution;
  isWeekend: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
};

export type TimelineV2ColumnSet = {
  viewMode: TimelineV2ViewMode;
  resolution: TimelineV2Resolution;
  startDate: string;
  endDate: string;
  columns: TimelineV2Column[];
};

export type TimelineV2Filters = {
  brandId: string | null;
  department: string | null;
  searchQuery?: string;
  projectId: string | null;
};

export type TimelineV2Resource = Resource & {
  employee: Employee;
};

export type TimelineV2CampaignRow = {
  id: string;
  project: ProjectOption;
  brand?: Brand;
  planAssignments: Assignment[];
  actualAssignments: ActualAssignment[];
  isHighlighted: boolean;
};

export type TimelineV2CampaignGroup = {
  id: string;
  name: string;
  brandName?: string;
  isHighlighted: boolean;
  row: TimelineV2CampaignRow;
};

export type TimelineV2ResourceRow = {
  id: string;
  resource: TimelineV2Resource;
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  timeOffAssignments: Assignment[];
  campaignGroups: TimelineV2CampaignGroup[];
  isExpanded: boolean;
};
