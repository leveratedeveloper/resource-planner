# Timeline V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a brand new `timeline-v2` page implementation that replaces the current timeline while preserving existing appearance, data, filters, navigation controls, resource rows, assignment interactions, actuals, monthly allocation, loading states, and access behavior.

**Architecture:** Build v2 as a parallel module, keep existing timeline files intact during development, and switch `app/HomeClient.tsx` to `TimelineV2` only after parity tests pass. V2 separates query orchestration, pure timeline modeling, layout math, interaction state, and presentational rendering so resource rows render prepared row data instead of owning global data flow and mutation workflows.

**Tech Stack:** Next.js App Router, React 19, TypeScript, TanStack Query, TanStack Virtual, date-fns, Tailwind CSS, existing shadcn/Radix UI primitives, Vitest.

---

## Current Timeline Features That Must Persist

The current behavior lives primarily in:

- `app/HomeClient.tsx`
- `components/filters/FilterBar.tsx`
- `components/filters/TimelineScopeSelect.tsx`
- `components/timeline/Timeline.tsx`
- `components/timeline/TimelineHeaderControls.tsx`
- `components/timeline/TimelineDataStatus.tsx`
- `components/timeline/ResourceRow.tsx`
- `components/timeline/AllocationCell.tsx`
- `components/timeline/AssignmentBlock.tsx`
- `components/timeline/ActualAssignmentBlock.tsx`
- `components/timeline/DraggableTimelineCell.tsx`
- `components/timeline/AssignmentPopover.tsx`
- `components/timeline/ActualAssignmentPopover.tsx`
- `components/timeline/MonthlyAllocationModal.tsx`
- `components/timeline/MonthlyAllocationConfirmation.tsx`
- `lib/timeline/*`
- `lib/query/hooks/usePlannerTimeline.ts`
- `lib/query/hooks/useAssignments.ts`
- `lib/query/hooks/useActualAssignments.ts`

V2 must preserve these user-visible features:

- Global filter bar: search input, brand select, department select, project select, export button, dashboard button, setup button, user menu, logout.
- Search behavior: search names, position, department, employee assignments, project names, and brand names using the existing debounced search from `HomeClient`.
- Resource scope filters: brand, department, and project filter resources without destructively filtering planner assignment payloads.
- Timeline toolbar: Today button, previous/next buttons, current period label, Week/Month/Quarter/Half Year/Year segmented tabs, and weekend toggle for week/month views.
- Timeline ranges: week shows Monday-Sunday daily cells, month shows daily cells, quarter/half-year/year show monthly cells.
- Weekend preference: default weekends hidden, stored in `localStorage` key `showWeekends`.
- Sticky layout: toolbar above the grid, sticky date header, sticky/resizable resource column, synchronized horizontal scroll.
- Resource loading strategy: complete employee list for active brand/department/project/search filters; incremental employee pages otherwise.
- Vertical virtualization: resource rows virtualized with overscan and next-page fetch near the visible end.
- Row expansion state: collapsed by default, expandable per employee, reset expanded rows when brand/department/project/search filters change.
- Collapsed resource row: identity cell with avatar initials, name, role, department, and timeline allocation bar.
- Expanded resource row: summary allocation row, Time Off row, campaign header rows, campaign lanes, plan lane, actual lane, creation affordances, and loading skeletons.
- Allocation colors: planned blue utilization, actual green where shown, over-capacity red top border, time off gray full-cell treatment.
- Assignment display: planned blocks are blue, actual blocks are green, time-off blocks are gray, selected brand/project highlight uses amber ring/background.
- Assignment interactions: click to edit, drag to move, resize left/right, block editing while planner data refreshes or failed refresh is displayed.
- Creation interactions: drag/click day cells to create planned assignment, actual assignment, or time off; weekend confirmation for non-working days.
- Monthly range behavior: quarter/half-year/year use monthly summaries, monthly allocation modal for create/edit/delete, adjustment hour support, detail fetch when opening monthly summary records.
- Actuals behavior: actual assignments render separately from planned assignments and use current actual popovers/dialogs.
- Loading/error status: initial skeletons, row-level timeline loading during planner refresh, expanded loading skeletons, "Applying filters...", "Updating planner...", and "Showing saved planner data. Refresh failed."
- Access behavior: full access can edit planned assignments; restricted access can view plans disabled; actual assignment permissions remain consistent with current dialogs/hooks.
- Startup behavior: `HomePlannerTimeline` still logs `planner_startup` critical ready timing.
- Expanded-row grouping change: clicking the dropdown next to a resource must show campaigns, not deliverables. V2 must group expanded rows by assigned campaign/project (`ProjectOption.name`, usually sourced from campaign data), keep brand/project highlighting, and stop using assignment-note deliverable parsing to decide expanded row headers.

V2 must remove or avoid these current problems:

- No row component should fetch broad data, own global filters, own query invalidation strategy, and render all UI at once.
- No debug `console.log` output should remain in committed v2 timeline code.
- Planned and actual block positioning logic should not be duplicated in two separate components.
- Monthly allocation network transactions should not live inside a render-heavy resource row component.
- Grid cells should be lightweight; assignment blocks should be positioned overlays instead of every cell owning complex behavior.

---

## File Structure

Create new v2 files. Keep existing `components/timeline/*` and `lib/timeline/*` files during the build so parity can be tested safely.

- Create `components/timeline-v2/TimelineV2.tsx`
  - Top-level timeline container. Owns query hooks, date/view state, resource column sizing, scroll refs, virtualizer, and composes v2 components.
- Create `components/timeline-v2/TimelineToolbarV2.tsx`
  - V2 replacement for `TimelineHeaderControls`.
- Create `components/timeline-v2/TimelineDataStatusV2.tsx`
  - Thin v2 wrapper or copy of the existing status display with v2 test ids.
- Create `components/timeline-v2/TimelineHeaderV2.tsx`
  - Sticky resource header and date/month header cells.
- Create `components/timeline-v2/TimelineBodyV2.tsx`
  - Scrollable virtualized body and infinite employee fetch trigger.
- Create `components/timeline-v2/ResourceRowV2.tsx`
  - Renders one prepared `TimelineResourceRowV2` in collapsed or expanded mode.
- Create `components/timeline-v2/ResourceIdentityCellV2.tsx`
  - Sticky left resource identity cell.
- Create `components/timeline-v2/AllocationCellV2.tsx`
  - V2 allocation cell renderer using a v2 model.
- Create `components/timeline-v2/TimelineLaneV2.tsx`
  - Lightweight row lane with grid background, drag-create affordance, and positioned blocks.
- Create `components/timeline-v2/AssignmentBlockV2.tsx`
  - Unified planned/time-off/actual block renderer driven by a `kind` prop.
- Create `components/timeline-v2/MonthlyAllocationBlockV2.tsx`
  - Monthly summary block for quarter/half-year/year planned allocations.
- Create `components/timeline-v2/TimelineLoadingStatesV2.tsx`
  - Initial skeleton, row skeleton, expanded campaign skeleton, and empty state.
- Create `components/timeline-v2/useTimelineV2Controller.ts`
  - Client hook for v2 interaction state, guarded mutation calls, modal state, popover state, and query invalidation orchestration.
- Create `components/timeline-v2/index.ts`
  - Public exports for v2 timeline components.
- Create `lib/timeline-v2/types.ts`
  - Shared v2 TypeScript types.
- Create `lib/timeline-v2/date-range.ts`
  - View-mode date range and visible column generation.
- Create `lib/timeline-v2/layout.ts`
  - Column width, header width, date-to-column, range-to-position, and resize clamp helpers.
- Create `lib/timeline-v2/row-model.ts`
  - Build `TimelineResourceRowV2[]` from employees, assignments, actuals, campaign/project summaries, brands, filters, expansion state, and loading state.
- Create `lib/timeline-v2/assignment-positioning.ts`
  - Pure planned/actual/time-off/monthly block positioning.
- Create `lib/timeline-v2/allocation-model.ts`
  - V2 allocation model. Start by matching existing `lib/timeline/allocation-cell-model.ts`.
- Create `lib/timeline-v2/monthly-allocation-service.ts`
  - Fetch monthly detail, delete monthly assignments, save monthly distributions, and invalidate queries.
- Create `lib/timeline-v2/interaction-model.ts`
  - Pure helpers for drag-create, drag-move, resize, weekend confirmation, and time-off collision checks.
- Create `tests/whitebox/timeline-v2-date-range.test.ts`
- Create `tests/whitebox/timeline-v2-layout.test.ts`
- Create `tests/whitebox/timeline-v2-row-model.test.ts`
- Create `tests/whitebox/timeline-v2-assignment-positioning.test.ts`
- Create `tests/whitebox/timeline-v2-allocation-model.test.ts`
- Create `tests/whitebox/timeline-v2-source-parity.test.ts`
- Modify `app/HomeClient.tsx`
  - Replace `Timeline` import/render with `TimelineV2` after v2 parity tasks pass.
- Do not modify `components/filters/FilterBar.tsx` unless a test proves the v2 timeline needs a new prop from the existing filter bar. The existing filter bar persists as the page-level filter UI.

---

## Task 1: Date Range And Column Model

**Files:**
- Create: `lib/timeline-v2/types.ts`
- Create: `lib/timeline-v2/date-range.ts`
- Test: `tests/whitebox/timeline-v2-date-range.test.ts`

- [x] **Step 1: Write failing tests for v2 visible columns**

```ts
import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { getTimelineV2Columns } from "@/lib/timeline-v2/date-range";

const labels = (dates: Date[]) => dates.map((date) => format(date, "yyyy-MM-dd"));

describe("timeline-v2 date range", () => {
  it("builds a Monday-start week and hides weekends by default", () => {
    const result = getTimelineV2Columns({
      anchorDate: new Date("2026-06-04T00:00:00"),
      viewMode: "week",
      showWeekends: false,
    });

    expect(labels(result.columns.map((column) => column.date))).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
    expect(result.startDate).toBe("2026-06-01");
    expect(result.endDate).toBe("2026-06-07");
    expect(result.resolution).toBe("day");
  });

  it("builds daily month columns with optional weekends", () => {
    const result = getTimelineV2Columns({
      anchorDate: new Date("2026-02-10T00:00:00"),
      viewMode: "month",
      showWeekends: true,
    });

    expect(result.columns).toHaveLength(28);
    expect(labels([result.columns[0].date, result.columns[27].date])).toEqual([
      "2026-02-01",
      "2026-02-28",
    ]);
    expect(result.resolution).toBe("day");
  });

  it("builds monthly columns for quarter, half-year, and year views", () => {
    expect(
      labels(getTimelineV2Columns({
        anchorDate: new Date("2026-06-04T00:00:00"),
        viewMode: "quarter",
        showWeekends: false,
      }).columns.map((column) => column.date))
    ).toEqual(["2026-04-01", "2026-05-01", "2026-06-01"]);

    expect(
      getTimelineV2Columns({
        anchorDate: new Date("2026-09-04T00:00:00"),
        viewMode: "halfYear",
        showWeekends: false,
      }).columns
    ).toHaveLength(6);

    expect(
      getTimelineV2Columns({
        anchorDate: new Date("2026-09-04T00:00:00"),
        viewMode: "year",
        showWeekends: false,
      }).columns
    ).toHaveLength(12);
  });
});
```

- [x] **Step 2: Run the date-range test and verify it fails**

Run: `npm run test -- tests/whitebox/timeline-v2-date-range.test.ts`

Expected: FAIL because `@/lib/timeline-v2/date-range` does not exist.

- [x] **Step 3: Create v2 shared types**

```ts
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
```

- [x] **Step 4: Implement v2 date range helper**

```ts
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  getMonth,
  getYear,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toLocalDateString } from "@/lib/utils";
import type {
  TimelineV2Column,
  TimelineV2ColumnSet,
  TimelineV2Resolution,
  TimelineV2ViewMode,
} from "@/lib/timeline-v2/types";

function getAllColumns(anchorDate: Date, viewMode: TimelineV2ViewMode): Date[] {
  switch (viewMode) {
    case "week": {
      const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    }
    case "month": {
      const start = startOfMonth(anchorDate);
      return eachDayOfInterval({
        start,
        end: addDays(startOfMonth(addMonths(anchorDate, 1)), -1),
      });
    }
    case "quarter": {
      const startMonth = Math.floor(anchorDate.getMonth() / 3) * 3;
      const start = new Date(anchorDate.getFullYear(), startMonth, 1);
      const end = new Date(anchorDate.getFullYear(), startMonth + 2, 1);
      return eachMonthOfInterval({ start, end });
    }
    case "halfYear": {
      const startMonth = anchorDate.getMonth() < 6 ? 0 : 6;
      const start = new Date(anchorDate.getFullYear(), startMonth, 1);
      const end = new Date(anchorDate.getFullYear(), startMonth + 5, 1);
      return eachMonthOfInterval({ start, end });
    }
    case "year":
      return eachMonthOfInterval({
        start: new Date(anchorDate.getFullYear(), 0, 1),
        end: new Date(anchorDate.getFullYear(), 11, 1),
      });
  }
}

export function getTimelineV2Resolution(viewMode: TimelineV2ViewMode): TimelineV2Resolution {
  return viewMode === "week" || viewMode === "month" ? "day" : "month";
}

export function getTimelineV2Columns({
  anchorDate,
  viewMode,
  showWeekends,
}: {
  anchorDate: Date;
  viewMode: TimelineV2ViewMode;
  showWeekends: boolean;
}): TimelineV2ColumnSet {
  const resolution = getTimelineV2Resolution(viewMode);
  const allColumns = getAllColumns(anchorDate, viewMode);
  const visibleDates = resolution === "month" || showWeekends
    ? allColumns
    : allColumns.filter((date) => date.getDay() !== 0 && date.getDay() !== 6);
  const rangeStart = allColumns[0];
  const rangeEnd = allColumns[allColumns.length - 1];
  const today = new Date();

  const columns: TimelineV2Column[] = visibleDates.map((date) => ({
    id: toLocalDateString(date),
    date,
    label: resolution === "month" ? format(date, "MMMM") : format(date, "EEE"),
    subLabel: resolution === "month" ? null : format(date, "d"),
    kind: resolution,
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
    isToday: isToday(date),
    isCurrentMonth: getMonth(date) === getMonth(today) && getYear(date) === getYear(today),
  }));

  return {
    viewMode,
    resolution,
    startDate: toLocalDateString(rangeStart),
    endDate: resolution === "month"
      ? toLocalDateString(new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() + 1, 0))
      : toLocalDateString(rangeEnd),
    columns,
  };
}
```

- [x] **Step 5: Run the date-range test and verify it passes**

Run: `npm run test -- tests/whitebox/timeline-v2-date-range.test.ts`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add lib/timeline-v2/types.ts lib/timeline-v2/date-range.ts tests/whitebox/timeline-v2-date-range.test.ts
git commit -m "feat: add timeline v2 date range model"
```

---

## Task 2: Layout And Assignment Positioning

**Files:**
- Create: `lib/timeline-v2/layout.ts`
- Create: `lib/timeline-v2/assignment-positioning.ts`
- Test: `tests/whitebox/timeline-v2-layout.test.ts`
- Test: `tests/whitebox/timeline-v2-assignment-positioning.test.ts`

- [x] **Step 1: Write failing layout tests**

```ts
import { describe, expect, it } from "vitest";
import {
  clampTimelineV2ResourceColumnWidth,
  getTimelineV2Layout,
  getTimelineV2RangePosition,
} from "@/lib/timeline-v2/layout";

describe("timeline-v2 layout", () => {
  it("clamps the resource column to the existing visual bounds", () => {
    expect(clampTimelineV2ResourceColumnWidth(100)).toBe(220);
    expect(clampTimelineV2ResourceColumnWidth(250)).toBe(250);
    expect(clampTimelineV2ResourceColumnWidth(800)).toBe(420);
  });

  it("uses exact available width for visible columns", () => {
    expect(getTimelineV2Layout({ availableWidth: 1000, columnCount: 5 })).toEqual({
      columnWidth: 200,
      timelineWidth: 1000,
    });
  });

  it("converts column ranges to percentage positions", () => {
    expect(getTimelineV2RangePosition({ startIndex: 1, endIndex: 3, columnCount: 5 })).toEqual({
      leftPct: 20,
      widthPct: 60,
    });
  });
});
```

- [x] **Step 2: Write failing assignment positioning tests**

```ts
import { describe, expect, it } from "vitest";
import { getTimelineV2AssignmentPosition } from "@/lib/timeline-v2/assignment-positioning";
import type { TimelineV2Column } from "@/lib/timeline-v2/types";

function column(date: string, kind: "day" | "month" = "day"): TimelineV2Column {
  return {
    id: date,
    date: new Date(`${date}T00:00:00`),
    label: date,
    subLabel: null,
    kind,
    isWeekend: false,
    isToday: false,
    isCurrentMonth: false,
  };
}

describe("timeline-v2 assignment positioning", () => {
  it("clips daily assignments to the visible day range", () => {
    const position = getTimelineV2AssignmentPosition({
      startDate: "2026-06-02",
      endDate: "2026-06-04",
      columns: [
        column("2026-06-01"),
        column("2026-06-02"),
        column("2026-06-03"),
        column("2026-06-04"),
        column("2026-06-05"),
      ],
      resolution: "day",
    });

    expect(position).toEqual({ startIndex: 1, endIndex: 3, leftPct: 20, widthPct: 60 });
  });

  it("returns null when the assignment is outside the visible range", () => {
    expect(getTimelineV2AssignmentPosition({
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      columns: [column("2026-06-01"), column("2026-06-02")],
      resolution: "day",
    })).toBeNull();
  });

  it("positions monthly summaries by month column", () => {
    expect(getTimelineV2AssignmentPosition({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      columns: [
        column("2026-04-01", "month"),
        column("2026-05-01", "month"),
        column("2026-06-01", "month"),
      ],
      resolution: "month",
    })).toEqual({ startIndex: 1, endIndex: 1, leftPct: 33.333333333333336, widthPct: 33.333333333333336 });
  });
});
```

- [x] **Step 3: Run tests and verify they fail**

Run: `npm run test -- tests/whitebox/timeline-v2-layout.test.ts tests/whitebox/timeline-v2-assignment-positioning.test.ts`

Expected: FAIL because layout and positioning modules do not exist.

- [x] **Step 4: Implement layout helpers**

```ts
export const TIMELINE_V2_DEFAULT_RESOURCE_COLUMN_WIDTH = 250;
export const TIMELINE_V2_MIN_RESOURCE_COLUMN_WIDTH = 220;
export const TIMELINE_V2_MAX_RESOURCE_COLUMN_WIDTH = 420;
export const TIMELINE_V2_ROW_ESTIMATE = 56;

export function clampTimelineV2ResourceColumnWidth(width: number): number {
  return Math.min(
    TIMELINE_V2_MAX_RESOURCE_COLUMN_WIDTH,
    Math.max(TIMELINE_V2_MIN_RESOURCE_COLUMN_WIDTH, width)
  );
}

export function getTimelineV2Layout({
  availableWidth,
  columnCount,
}: {
  availableWidth: number;
  columnCount: number;
}) {
  const safeColumnCount = Math.max(columnCount, 1);
  const timelineWidth = Math.max(availableWidth, 100);

  return {
    columnWidth: timelineWidth / safeColumnCount,
    timelineWidth,
  };
}

export function getTimelineV2RangePosition({
  startIndex,
  endIndex,
  columnCount,
}: {
  startIndex: number;
  endIndex: number;
  columnCount: number;
}) {
  const safeColumnCount = Math.max(columnCount, 1);
  const normalizedStart = Math.max(0, Math.min(safeColumnCount - 1, startIndex));
  const normalizedEnd = Math.max(normalizedStart, Math.min(safeColumnCount - 1, endIndex));
  const cellPct = 100 / safeColumnCount;

  return {
    leftPct: normalizedStart * cellPct,
    widthPct: (normalizedEnd - normalizedStart + 1) * cellPct,
  };
}
```

- [x] **Step 5: Implement assignment positioning helper**

```ts
import { endOfMonth, startOfDay, startOfMonth } from "date-fns";
import { getTimelineV2RangePosition } from "@/lib/timeline-v2/layout";
import type {
  TimelineV2Column,
  TimelineV2Resolution,
} from "@/lib/timeline-v2/types";

type TimelineV2AssignmentPositionInput = {
  startDate: string;
  endDate: string;
  columns: TimelineV2Column[];
  resolution: TimelineV2Resolution;
};

export type TimelineV2AssignmentPosition = {
  startIndex: number;
  endIndex: number;
  leftPct: number;
  widthPct: number;
};

function parseLocalDate(value: string): Date {
  return startOfDay(new Date(`${value}T00:00:00`));
}

function getColumnRange(column: TimelineV2Column, resolution: TimelineV2Resolution) {
  const start = resolution === "month"
    ? startOfMonth(column.date)
    : startOfDay(column.date);
  const end = resolution === "month"
    ? endOfMonth(column.date)
    : startOfDay(column.date);

  return { start, end };
}

export function getTimelineV2AssignmentPosition({
  startDate,
  endDate,
  columns,
  resolution,
}: TimelineV2AssignmentPositionInput): TimelineV2AssignmentPosition | null {
  if (columns.length === 0) return null;

  const assignmentStart = parseLocalDate(startDate);
  const assignmentEnd = parseLocalDate(endDate);
  let startIndex = -1;
  let endIndex = -1;

  columns.forEach((column, index) => {
    const range = getColumnRange(column, resolution);
    const overlaps = assignmentEnd >= range.start && assignmentStart <= range.end;

    if (!overlaps) return;
    if (startIndex === -1) startIndex = index;
    endIndex = index;
  });

  if (startIndex === -1 || endIndex === -1) return null;

  return {
    startIndex,
    endIndex,
    ...getTimelineV2RangePosition({
      startIndex,
      endIndex,
      columnCount: columns.length,
    }),
  };
}
```

- [x] **Step 6: Run layout and positioning tests**

Run: `npm run test -- tests/whitebox/timeline-v2-layout.test.ts tests/whitebox/timeline-v2-assignment-positioning.test.ts`

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add lib/timeline-v2/layout.ts lib/timeline-v2/assignment-positioning.ts tests/whitebox/timeline-v2-layout.test.ts tests/whitebox/timeline-v2-assignment-positioning.test.ts
git commit -m "feat: add timeline v2 layout model"
```

---

## Task 3: Row Model And Filter Parity

**Files:**
- Create: `lib/timeline-v2/row-model.ts`
- Test: `tests/whitebox/timeline-v2-row-model.test.ts`

- [x] **Step 1: Write failing row model tests**

```ts
import { describe, expect, it } from "vitest";
import { buildTimelineV2Rows, groupTimelineV2AssignmentsByEmployee } from "@/lib/timeline-v2/row-model";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

const employee = (id: string, name: string): Employee => ({
  id,
  uuid: id,
  fullName: name,
  full_name: name,
  nickname: name,
  position: "Designer",
  weeklyCapacity: 40,
  departmentId: "dept-1",
  department: { id: "dept-1", name: "Creative", color: "#111827" },
  assignments: [],
  employeeBrandAssignments: [],
}) as Employee;

const assignment = (overrides: Partial<Assignment>): Assignment => ({
  id: overrides.id ?? "assignment-1",
  employeeId: overrides.employeeId ?? "employee-1",
  projectId: overrides.projectId ?? "project-1",
  taskId: null,
  startDate: overrides.startDate ?? "2026-06-01",
  endDate: overrides.endDate ?? "2026-06-05",
  hoursPerDay: overrides.hoursPerDay ?? "8",
  allocationPercentage: null,
  totalHours: overrides.totalHours ?? null,
  isTimeOff: overrides.isTimeOff ?? false,
  timeOffTypeId: null,
  category: overrides.category ?? "Other",
  isBillable: overrides.isBillable ?? true,
  isAdjustment: overrides.isAdjustment ?? false,
  status: overrides.status ?? "draft",
  note: overrides.note ?? null,
  createdById: null,
  createdAt: "2026-06-01",
  updatedAt: "2026-06-01",
}) as Assignment;

const project = (id: string): ProjectOption => ({
  id,
  name: `Project ${id}`,
  color: "#2563eb",
  brandId: "brand-1",
}) as ProjectOption;

describe("timeline-v2 row model", () => {
  it("groups assignments by employee without row-level filtering work", () => {
    const grouped = groupTimelineV2AssignmentsByEmployee([
      assignment({ id: "a", employeeId: "employee-1" }),
      assignment({ id: "b", employeeId: "employee-2" }),
      assignment({ id: "c", employeeId: "employee-1" }),
    ]);

    expect(grouped.get("employee-1")?.map((item) => item.id)).toEqual(["a", "c"]);
    expect(grouped.get("employee-2")?.map((item) => item.id)).toEqual(["b"]);
  });

  it("builds expanded row groups with campaigns and time off split out", () => {
    const rows = buildTimelineV2Rows({
      employees: [employee("employee-1", "Ada Lovelace")],
      assignments: [
        assignment({ id: "plan-1", employeeId: "employee-1", projectId: "project-1", note: "Deliverables: UX" }),
        assignment({ id: "off-1", employeeId: "employee-1", projectId: null, isTimeOff: true }),
      ],
      actualAssignments: [],
      projects: [project("project-1")],
      brandById: new Map([["brand-1", { id: "brand-1", name: "Brand One" } as never]]),
      expandedEmployeeIds: new Set(["employee-1"]),
      filters: { brandId: "brand-1", department: null, projectId: null, searchQuery: "" },
      days: [new Date("2026-06-01T00:00:00")],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].resource.name).toBe("Ada Lovelace");
    expect(rows[0].timeOffAssignments.map((item) => item.id)).toEqual(["off-1"]);
    expect(rows[0].campaignGroups[0].name).toBe("Project project-1");
    expect(rows[0].campaignGroups[0].row.project.id).toBe("project-1");
    expect(rows[0].campaignGroups[0].row.planAssignments.map((item) => item.id)).toEqual(["plan-1"]);
  });
});
```

- [x] **Step 2: Run the row model test and verify it fails**

Run: `npm run test -- tests/whitebox/timeline-v2-row-model.test.ts`

Expected: FAIL because `@/lib/timeline-v2/row-model` does not exist.

- [x] **Step 3: Implement row model with existing filter/project helpers**

```ts
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { filterTimelineEmployees } from "@/lib/timeline/employees";
import {
  getResourceProjects,
  isProjectHighlighted,
  sortResourceProjects,
} from "@/lib/timeline/resource-project-model";
import type {
  TimelineV2CampaignGroup,
  TimelineV2Filters,
  TimelineV2ResourceRow,
} from "@/lib/timeline-v2/types";

export function groupTimelineV2AssignmentsByEmployee(assignments: Assignment[]) {
  const grouped = new Map<string, Assignment[]>();

  assignments.forEach((assignment) => {
    if (!grouped.has(assignment.employeeId)) grouped.set(assignment.employeeId, []);
    grouped.get(assignment.employeeId)!.push(assignment);
  });

  return grouped;
}

export function groupTimelineV2ActualAssignmentsByEmployee(actualAssignments: ActualAssignment[]) {
  const grouped = new Map<string, ActualAssignment[]>();

  actualAssignments.forEach((assignment) => {
    if (!assignment.employeeUuid) return;
    if (!grouped.has(assignment.employeeUuid)) grouped.set(assignment.employeeUuid, []);
    grouped.get(assignment.employeeUuid)!.push(assignment);
  });

  return grouped;
}

export function buildTimelineV2Rows({
  employees,
  assignments,
  actualAssignments,
  projects,
  brandById,
  expandedEmployeeIds,
  filters,
  days,
  selectedBrandProjectIds,
}: {
  employees: Employee[];
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  projects: ProjectOption[];
  brandById: Map<string, Brand>;
  expandedEmployeeIds: Set<string>;
  filters: TimelineV2Filters;
  days: Date[];
  selectedBrandProjectIds?: Set<string>;
}): TimelineV2ResourceRow[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const filteredEmployees = filterTimelineEmployees({
    employees,
    dateFilteredAssignments: assignments,
    visibleActualAssignments: actualAssignments,
    projectById,
    selectedBrandProjectIds,
    filters,
  });
  const assignmentsByEmployee = groupTimelineV2AssignmentsByEmployee(assignments);
  const actualsByEmployee = groupTimelineV2ActualAssignmentsByEmployee(actualAssignments);

  return filteredEmployees.map((employee) => {
    const resourceAssignments = assignmentsByEmployee.get(employee.id) ?? [];
    const employeeActuals = actualsByEmployee.get(employee.id) ?? [];
    const resourceProjects = getResourceProjects(resourceAssignments, employeeActuals, projects);
    const sortedProjects = sortResourceProjects({
      projects: resourceProjects,
      resourceAssignments,
      brandId: filters.brandId,
      selectedProjectId: filters.projectId,
      days,
    });
    const highlightFilters = {
      selectedBrandId: filters.brandId,
      selectedProjectId: filters.projectId,
    };
    const campaignGroups: TimelineV2CampaignGroup[] = sortedProjects.map((project) => {
      const brand = project.brandId ? brandById.get(project.brandId) : undefined;
      const planAssignments = resourceAssignments.filter(
        (assignment) => assignment.projectId === project.id && !assignment.isTimeOff
      );
      const matchingActualAssignments = employeeActuals.filter(
        (assignment) => assignment.projectUuid === project.id && !assignment.isTimeOff
      );
      const isHighlighted = isProjectHighlighted(project, highlightFilters);

      return {
        id: project.id,
        name: project.name,
        brandName: brand?.name,
        isHighlighted,
        row: {
          id: project.id,
          project,
          brand,
          planAssignments,
          actualAssignments: matchingActualAssignments,
          isHighlighted,
        },
      };
    });

    return {
      id: employee.id,
      resource: {
        id: employee.id,
        name: employee.fullName,
        role: employee.position,
        department: employee.department?.name || "",
        capacity: employee.weeklyCapacity,
        employee,
      },
      assignments: resourceAssignments,
      actualAssignments: employeeActuals,
      timeOffAssignments: resourceAssignments.filter((assignment) => assignment.isTimeOff),
      campaignGroups,
      isExpanded: expandedEmployeeIds.has(employee.id),
    };
  });
}
```

- [x] **Step 4: Run the row model test**

Run: `npm run test -- tests/whitebox/timeline-v2-row-model.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add lib/timeline-v2/row-model.ts tests/whitebox/timeline-v2-row-model.test.ts
git commit -m "feat: add timeline v2 row model"
```

---

## Task 4: Allocation Model Parity

**Files:**
- Create: `lib/timeline-v2/allocation-model.ts`
- Test: `tests/whitebox/timeline-v2-allocation-model.test.ts`

- [x] **Step 1: Write failing parity tests against known allocation behavior**

```ts
import { describe, expect, it } from "vitest";
import { getTimelineV2AllocationModel } from "@/lib/timeline-v2/allocation-model";

describe("timeline-v2 allocation model", () => {
  it("marks time off as a full gray cell in daily views", () => {
    const model = getTimelineV2AllocationModel({
      day: new Date("2026-06-02T00:00:00"),
      resource: { id: "employee-1", name: "Ada", role: "Designer", department: "Creative", capacity: 40 },
      assignments: [{
        id: "off",
        employeeId: "employee-1",
        projectId: null,
        startDate: "2026-06-02",
        endDate: "2026-06-02",
        hoursPerDay: "8",
        isTimeOff: true,
      } as never],
      actualAssignments: [],
      isWeekView: false,
      isMonthRangeView: false,
    });

    expect(model).toEqual({ kind: "time-off" });
  });

  it("calculates planned utilization percentage from daily capacity", () => {
    const model = getTimelineV2AllocationModel({
      day: new Date("2026-06-02T00:00:00"),
      resource: { id: "employee-1", name: "Ada", role: "Designer", department: "Creative", capacity: 40 },
      assignments: [{
        id: "plan",
        employeeId: "employee-1",
        projectId: "project-1",
        startDate: "2026-06-02",
        endDate: "2026-06-02",
        hoursPerDay: "4",
        isTimeOff: false,
      } as never],
      actualAssignments: [],
      isWeekView: false,
      isMonthRangeView: false,
    });

    expect(model).toMatchObject({ kind: "allocation", planPct: 0.5, planLabel: "50%" });
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `npm run test -- tests/whitebox/timeline-v2-allocation-model.test.ts`

Expected: FAIL because `@/lib/timeline-v2/allocation-model` does not exist.

- [x] **Step 3: Implement v2 allocation model as a thin named wrapper**

```ts
export {
  getAllocationCellModel as getTimelineV2AllocationModel,
  type AllocationCellModel as TimelineV2AllocationModel,
} from "@/lib/timeline/allocation-cell-model";
```

- [x] **Step 4: Run the allocation model test**

Run: `npm run test -- tests/whitebox/timeline-v2-allocation-model.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add lib/timeline-v2/allocation-model.ts tests/whitebox/timeline-v2-allocation-model.test.ts
git commit -m "feat: add timeline v2 allocation model"
```

---

## Task 5: V2 Toolbar, Header, Status, And Loading Components

**Files:**
- Create: `components/timeline-v2/TimelineToolbarV2.tsx`
- Create: `components/timeline-v2/TimelineDataStatusV2.tsx`
- Create: `components/timeline-v2/TimelineHeaderV2.tsx`
- Create: `components/timeline-v2/TimelineLoadingStatesV2.tsx`

- [x] **Step 1: Create `TimelineToolbarV2.tsx`**

Implement the same user controls and test ids with v2 component name. Preserve: Today, previous, next, period label, Week/Month/Quarter/Half Year/Year tabs, weekend toggle only for week/month, and centered layout placeholder for longer views.

- [x] **Step 2: Create `TimelineDataStatusV2.tsx`**

Use the same visual treatment as `TimelineDataStatus`: border-bottom, compact text, warning/syncing tone classes, `data-testid="timeline-v2-data-status"`.

- [x] **Step 3: Create `TimelineHeaderV2.tsx`**

Render a flex row with:

- sticky left header text `Resources`
- resize separator with `aria-label="Resize resources column"`
- horizontally scrollable date/month header
- `data-testid="timeline-v2-day-cell"`
- `data-date`, `data-weekend`, and `data-today` attributes
- same background and primary bottom-border semantics as current header

- [x] **Step 4: Create `TimelineLoadingStatesV2.tsx`**

Export:

- `TimelineInitialSkeletonV2`
- `TimelineExpandedSkeletonV2`
- `TimelineRowLoadingCellsV2`
- `TimelineEmptyStateV2`
- `TimelineLoadingMoreV2`

Keep row heights consistent with constants from `lib/timeline-v2/layout.ts`.

- [x] **Step 5: Run lint for the new components**

Run: `npm run lint`

Expected: PASS or only pre-existing lint failures. If lint fails on v2 files, fix v2 files before proceeding.

- [x] **Step 6: Commit**

```bash
git add components/timeline-v2/TimelineToolbarV2.tsx components/timeline-v2/TimelineDataStatusV2.tsx components/timeline-v2/TimelineHeaderV2.tsx components/timeline-v2/TimelineLoadingStatesV2.tsx
git commit -m "feat: add timeline v2 shell components"
```

---

## Task 6: Unified Blocks And Lanes

**Files:**
- Create: `components/timeline-v2/AssignmentBlockV2.tsx`
- Create: `components/timeline-v2/MonthlyAllocationBlockV2.tsx`
- Create: `components/timeline-v2/TimelineLaneV2.tsx`
- Create: `lib/timeline-v2/interaction-model.ts`

- [x] **Step 1: Create pure interaction helper**

`lib/timeline-v2/interaction-model.ts` must export:

- `isTimelineV2Weekend(date: Date): boolean`
- `countTimelineV2Workdays(start: Date, end: Date): number`
- `hasTimelineV2TimeOffInRange(assignments, start, end, ignoredAssignmentId?)`
- `getTimelineV2DragRange(startIndex, endIndex)`

These helpers must contain no React imports.

- [x] **Step 2: Create `AssignmentBlockV2.tsx`**

Use a single block component for planned, actual, and time-off blocks:

- `kind="plan"`: blue background, `data-testid="timeline-v2-assignment-block"`
- `kind="actual"`: green background, `data-testid="timeline-v2-actual-assignment-block"`
- `kind="timeOff"`: gray background, `data-testid="timeline-v2-timeoff-block"`
- supports disabled state, highlighted state, updating/deleting state
- supports click, drag-to-move, left resize, right resize
- calls parent callbacks with normalized updates instead of mutating queries itself
- contains no debug logging

- [x] **Step 3: Create `MonthlyAllocationBlockV2.tsx`**

Render monthly summary blocks for quarter/half-year/year planned lanes:

- show project name and monthly total hours
- show adjustment overlay when adjustment total is greater than zero
- show loader overlay when detail is loading
- click calls parent `onOpenMonthlyAllocation`
- highlighted state matches amber ring behavior

- [x] **Step 4: Create `TimelineLaneV2.tsx`**

Render grid background cells and positioned blocks:

- daily lanes render lightweight interactive cells for plan/actual/time-off creation
- monthly lanes render a click target overlay and optional plus indicator for empty month cells
- lanes receive `columnWidth`, `timelineWidth`, and prepared blocks
- lanes never call mutation hooks directly

- [x] **Step 5: Run lint**

Run: `npm run lint`

Expected: PASS or only pre-existing lint failures. If lint fails on v2 files, fix v2 files before proceeding.

- [x] **Step 6: Commit**

```bash
git add lib/timeline-v2/interaction-model.ts components/timeline-v2/AssignmentBlockV2.tsx components/timeline-v2/MonthlyAllocationBlockV2.tsx components/timeline-v2/TimelineLaneV2.tsx
git commit -m "feat: add timeline v2 lanes and blocks"
```

---

## Task 7: Monthly Allocation Service

**Files:**
- Create: `lib/timeline-v2/monthly-allocation-service.ts`
- Modify: no existing files in this task

- [x] **Step 1: Create service API**

Export these functions:

- `getTimelineV2MonthlyDetailKey(resourceId, projectId, monthStart, monthEnd)`
- `fetchTimelineV2MonthlyAssignmentDetail({ resourceId, projectId, monthStart, monthEnd, signal })`
- `deleteTimelineV2AssignmentsById(ids: string[])`
- `saveTimelineV2MonthlyAllocation({ resourceId, projectId, distributions, category, isBillable, note, createAssignment })`
- `saveTimelineV2MonthlyAdjustment({ resourceId, projectId, adjustmentDistributions, category, isBillable, note, createAssignment })`

The functions must use the same `/api/assignments` and `/api/assignments/:id` endpoints that the current row uses. The service must not import React.

- [x] **Step 2: Move monthly transaction rules into service**

The service must preserve current behavior:

- load assignment detail for monthly summaries before edit when current planner assignment is a monthly summary
- delete overlapping non-adjustment records before creating new plan distributions
- delete adjustment records when removing or replacing adjustment distributions
- create adjustment records with `isAdjustment: true`
- use `credentials: "include"` for direct delete calls
- return counts of deleted and created records to the caller

- [x] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS or only pre-existing lint failures. If lint fails on this service, fix this service before proceeding.

- [x] **Step 4: Commit**

```bash
git add lib/timeline-v2/monthly-allocation-service.ts
git commit -m "feat: add timeline v2 monthly allocation service"
```

---

## Task 8: Timeline V2 Controller Hook

**Files:**
- Create: `components/timeline-v2/useTimelineV2Controller.ts`

- [x] **Step 1: Create controller hook**

The hook must own:

- `useCreateAssignment`, `useUpdateAssignment`, `useDeleteAssignment`
- `useCreateActualAssignment`
- query client invalidation for `queryKeys.plannerTimeline`, `queryKeys.assignments`, and `queryKeys.employees`
- selected popover data for planned assignment creation
- selected popover data for actual assignment creation
- selected monthly allocation modal data
- selected monthly allocation confirmation data
- updating/deleting assignment ids
- guarded update/delete callbacks based on `canEditAssignments`
- no rendering JSX

- [x] **Step 2: Preserve existing modal components**

The controller returns props for existing modal components:

- `AssignmentPopover`
- `ActualAssignmentPopover`
- `MonthlyAllocationModal`
- `MonthlyAllocationConfirmation`
- `EditAssignmentDialog` through block callbacks
- `EditActualAssignmentDialog` through block callbacks

Do not rewrite those modals in this task. Use them to reduce rewrite risk.

- [x] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS or only pre-existing lint failures. If lint fails on the controller, fix the controller before proceeding.

- [x] **Step 4: Commit**

```bash
git add components/timeline-v2/useTimelineV2Controller.ts
git commit -m "feat: add timeline v2 interaction controller"
```

---

## Task 9: Resource Row V2

**Files:**
- Create: `components/timeline-v2/ResourceIdentityCellV2.tsx`
- Create: `components/timeline-v2/AllocationCellV2.tsx`
- Create: `components/timeline-v2/ResourceRowV2.tsx`

- [x] **Step 1: Create resource identity cell**

`ResourceIdentityCellV2` must render:

- expand/collapse button with `data-testid="resource-row-v2-expand"` or `data-testid="resource-row-v2-collapse"`
- avatar initials
- resource name
- `role | department`
- sticky left column with the passed `resourceColumnWidth`

- [x] **Step 2: Create allocation cell**

`AllocationCellV2` must call `getTimelineV2AllocationModel` and render the same visual states as current `AllocationCell`:

- empty dashed cell
- time-off gray full cell
- planned blue utilization label
- over-capacity red top border

- [x] **Step 3: Create resource row**

`ResourceRowV2` must render:

- collapsed summary row with identity and allocation lane
- expanded summary row
- time-off row
- campaign header rows
- campaign rows with plan and actual lanes
- v2 loading skeletons when `showTimelineLoading` or `showExpandedLoading` is true
- `data-testid="resource-row-v2"`
- `data-resource-id`

The component must not fetch employees, brands, projects, assignments, actual assignments, or monthly details. It receives row model data and callbacks from `TimelineV2`.

- [x] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS or only pre-existing lint failures. If lint fails on v2 resource-row files, fix those files before proceeding.

- [x] **Step 5: Commit**

```bash
git add components/timeline-v2/ResourceIdentityCellV2.tsx components/timeline-v2/AllocationCellV2.tsx components/timeline-v2/ResourceRowV2.tsx
git commit -m "feat: add timeline v2 resource rows"
```

---

## Task 10: Timeline V2 Container And Body

**Files:**
- Create: `components/timeline-v2/TimelineBodyV2.tsx`
- Create: `components/timeline-v2/TimelineV2.tsx`
- Create: `components/timeline-v2/index.ts`

- [x] **Step 1: Create `TimelineBodyV2.tsx`**

`TimelineBodyV2` must own only scroll body rendering:

- receives `bodyScrollRef`
- receives virtual rows from parent
- renders `ResourceRowV2`
- renders loading more state for incremental employees
- emits body scroll callback for header sync

- [x] **Step 2: Create `TimelineV2.tsx`**

`TimelineV2` must preserve the current top-level timeline behavior:

- use `useEmployees` for complete employee loading when brand/department/project/search is active
- use `useInfiniteEmployees` otherwise
- use `useBrands`, `useProjectOptions`, `useProjectsByBrand`
- merge selected brand projects into project options
- build `plannerRequest` with `viewMode`, `resolution`, `startDate`, and `endDate`
- keep brand/project out of planner request payload filters
- use `usePlannerTimeline`
- group actuals and build v2 rows with `buildTimelineV2Rows`
- use TanStack Virtual with estimate size `56` and overscan `8`
- fetch next employee page near the end
- reset expansion and scroll offset when brand/department/project/search signature changes
- sync header/body horizontal scroll
- persist weekend toggle in `localStorage`
- expose resource column resize with same bounds
- render toolbar, data status, header, body, and existing popovers/modals from controller

- [x] **Step 3: Create public exports**

`components/timeline-v2/index.ts` must export:

```ts
export { TimelineV2 } from "./TimelineV2";
```

- [x] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS or only pre-existing lint failures. If lint fails on v2 container files, fix those files before proceeding.

- [x] **Step 5: Commit**

```bash
git add components/timeline-v2/TimelineBodyV2.tsx components/timeline-v2/TimelineV2.tsx components/timeline-v2/index.ts
git commit -m "feat: assemble timeline v2 container"
```

---

## Task 11: Source Parity Tests Before Switching

**Files:**
- Create: `tests/whitebox/timeline-v2-source-parity.test.ts`

- [x] **Step 1: Add source parity tests**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("timeline-v2 source parity", () => {
  it("preserves page-level filters in HomeClient", () => {
    const source = readFileSync("app/HomeClient.tsx", "utf8");

    expect(source).toContain("<FilterBar");
    expect(source).toContain("searchQuery={searchQuery}");
    expect(source).toContain("onBrandChange={setSelectedBrandId}");
    expect(source).toContain("onDepartmentChange={setSelectedDepartment}");
    expect(source).toContain("onProjectChange={setFilterProjectId}");
  });

  it("keeps brand and project ids out of planner assignment request filters", () => {
    const source = readFileSync("components/timeline-v2/TimelineV2.tsx", "utf8");

    expect(source).toContain("filterTimelineEmployees");
    expect(source).not.toContain("filters: { brandId");
    expect(source).not.toContain("filters: { projectId");
    expect(source).not.toContain("request.filters.brandId");
    expect(source).not.toContain("request.filters.projectId");
  });

  it("preserves required toolbar controls", () => {
    const source = readFileSync("components/timeline-v2/TimelineToolbarV2.tsx", "utf8");

    expect(source).toContain("timeline-v2-today-button");
    expect(source).toContain("timeline-v2-prev-button");
    expect(source).toContain("timeline-v2-next-button");
    expect(source).toContain("timeline-v2-view-week");
    expect(source).toContain("timeline-v2-view-month");
    expect(source).toContain("timeline-v2-view-quarter");
    expect(source).toContain("timeline-v2-view-half-year");
    expect(source).toContain("timeline-v2-view-year");
    expect(source).toContain("timeline-v2-weekend-toggle");
  });

  it("groups expanded resource rows by campaigns instead of deliverables", () => {
    const source = readFileSync("lib/timeline-v2/row-model.ts", "utf8");

    expect(source).toContain("campaignGroups");
    expect(source).toContain("project.name");
    expect(source).not.toContain("groupProjectsByDeliverable");
    expect(source).not.toContain("extractDeliverables");
  });

  it("does not keep debug logs in v2 timeline files", () => {
    const files = [
      "components/timeline-v2/TimelineV2.tsx",
      "components/timeline-v2/ResourceRowV2.tsx",
      "components/timeline-v2/AssignmentBlockV2.tsx",
      "components/timeline-v2/useTimelineV2Controller.ts",
      "lib/timeline-v2/monthly-allocation-service.ts",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("console.log");
      expect(source).not.toContain("console.debug");
    }
  });
});
```

- [x] **Step 2: Run parity tests**

Run: `npm run test -- tests/whitebox/timeline-v2-source-parity.test.ts`

Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add tests/whitebox/timeline-v2-source-parity.test.ts
git commit -m "test: add timeline v2 parity checks"
```

---

## Task 12: Switch Home Page To Timeline V2

**Files:**
- Modify: `app/HomeClient.tsx`

- [x] **Step 1: Modify import**

Replace:

```ts
import { Timeline } from "@/components/timeline/Timeline";
```

With:

```ts
import { TimelineV2 } from "@/components/timeline-v2";
```

- [x] **Step 2: Modify render**

Replace:

```tsx
<Timeline
  initialTimelineAnchor={initialTimelineAnchor}
  brandId={filters.brandId}
  department={filters.department}
  searchQuery={filters.searchQuery}
  projectId={filters.projectId}
/>
```

With:

```tsx
<TimelineV2
  initialTimelineAnchor={initialTimelineAnchor}
  brandId={filters.brandId}
  department={filters.department}
  searchQuery={filters.searchQuery}
  projectId={filters.projectId}
/>
```

- [x] **Step 3: Run focused timeline tests**

Run:

```bash
npm run test -- tests/whitebox/timeline-v2-date-range.test.ts tests/whitebox/timeline-v2-layout.test.ts tests/whitebox/timeline-v2-row-model.test.ts tests/whitebox/timeline-v2-assignment-positioning.test.ts tests/whitebox/timeline-v2-allocation-model.test.ts tests/whitebox/timeline-v2-source-parity.test.ts tests/whitebox/planner-timeline-loading.test.ts tests/whitebox/timeline-employees-performance.test.ts
```

Expected: PASS.

- [x] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS or only pre-existing lint failures. If lint fails on changed files, fix changed files before proceeding.

- [x] **Step 5: Run build**

Run: `npm run build`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add app/HomeClient.tsx
git commit -m "feat: switch planner to timeline v2"
```

---

## Task 13: Manual UI Validation

**Files:**
- Modify: only files required for defects found during validation

- [x] **Step 1: Start local dev server**

Run: `npm run dev`

Expected: Next.js dev server starts and prints a local URL.

- [x] **Step 2: Validate initial load**

Open the local URL in the browser and verify:

- filter bar renders
- timeline toolbar renders
- resource rows render
- sticky resource column remains visible while horizontal scrolling
- date header scrolls with the body
- resource rows virtualize without visible blanking during normal scroll

- [x] **Step 3: Validate filters**

Verify:

- typing in search updates resources after debounce
- brand filter scopes resources and keeps project rows highlighted
- department filter scopes resources
- project filter scopes resources and highlights selected project rows
- clearing filters restores the broad resource list

- [x] **Step 4: Validate view modes**

Verify:

- Week tab shows daily weekday columns by default
- Show Weekends adds Saturday/Sunday
- Month tab shows daily columns
- Quarter tab shows three monthly columns
- Half Year tab shows six monthly columns
- Year tab shows twelve monthly columns
- Today, previous, and next update the visible range

- [x] **Step 5: Validate resource rows**

Verify:

- collapsed row shows utilization cells
- expanded row shows Time Off, campaigns, plan lane, and actual lane
- expansion resets after changing brand, department, project, or search

- [x] **Step 6: Validate editing**

Using a full-access account, verify:

- create planned assignment by dragging a plan lane day range
- click planned assignment to edit
- resize planned assignment left and right
- drag planned assignment to move
- create time off
- blocked time-off days cannot receive new plan work
- create actual assignment
- click actual assignment to edit
- monthly allocation modal opens in quarter/half-year/year views
- monthly create/edit/delete works and refreshes planner data

- [x] **Step 7: Validate restricted access**

Using a restricted-access account, verify:

- plan assignments render disabled
- disabled plan blocks do not open edit actions
- actual assignment behavior matches current permission behavior

- [x] **Step 8: Fix defects and rerun validation**

For each defect, make the smallest v2-scoped change, rerun the specific test or browser step that caught it, then rerun:

```bash
npm run test -- tests/whitebox/timeline-v2-source-parity.test.ts
npm run lint
npm run build
```

Expected: PASS or only documented pre-existing lint failures.

- [x] **Step 9: Commit validation fixes**

```bash
git add components/timeline-v2 lib/timeline-v2 tests/whitebox app/HomeClient.tsx
git commit -m "fix: close timeline v2 validation gaps"
```

---

## Task 14: Cleanup After V2 Acceptance

**Files:**
- Modify or delete old timeline files only after the user accepts v2 behavior.

**Execution note:** Manual Chrome-driven validation was intentionally not used. Task 13 was completed with the user's live-load confirmation plus browser-free source/model/render tests, targeted lint, and production build. Full test and lint commands were run for Task 14; failures are documented as existing environment/project issues: unauthenticated blackbox API tests return `401`, and the repository has a pre-existing full-lint backlog outside the v2 cleanup scope.

- [x] **Step 1: Confirm v2 acceptance**

Ask the user to confirm that `timeline-v2` fully replaces the old timeline behavior.

- [x] **Step 2: Remove obsolete old timeline references**

After confirmation, search:

Run: `rg -n "@/components/timeline|components/timeline/|<Timeline|TimelineHeaderControls|ResourceRow" app components lib tests`

Expected: matches only old files, tests that intentionally cover legacy helpers, or no matches from active app code.

- [x] **Step 3: Decide deletion scope**

Keep old modal components that v2 still imports:

- `AssignmentPopover`
- `ActualAssignmentPopover`
- `MonthlyAllocationModal`
- `MonthlyAllocationConfirmation`
- edit dialogs used by v2 blocks

Delete only old renderer files that v2 no longer imports:

- old `Timeline.tsx`
- old `TimelineHeaderControls.tsx`
- old `ResourceRow.tsx`
- old `DraggableTimelineCell.tsx`
- old block components only if v2 has no imports from them

- [x] **Step 4: Run full verification**

Run:

```bash
npm run test
npm run lint
npm run build
```

Expected: PASS or only documented pre-existing lint failures.

- [x] **Step 5: Commit cleanup**

```bash
git add app components lib tests
git commit -m "chore: remove legacy timeline renderer"
```

---

## Validation Summary

Minimum automated validation before switching to v2:

```bash
npm run test -- tests/whitebox/timeline-v2-date-range.test.ts tests/whitebox/timeline-v2-layout.test.ts tests/whitebox/timeline-v2-row-model.test.ts tests/whitebox/timeline-v2-assignment-positioning.test.ts tests/whitebox/timeline-v2-allocation-model.test.ts tests/whitebox/timeline-v2-source-parity.test.ts
npm run lint
npm run build
```

Minimum manual validation before calling the rewrite complete:

- initial load
- filters/search
- every view tab
- weekend toggle
- sticky header/column scroll sync
- row expansion/collapse/reset
- collapsed allocation cells
- expanded time-off/campaign rows
- planned assignment create/edit/resize/move/delete
- actual assignment create/edit/resize/move/delete
- monthly allocation create/edit/delete
- restricted access disabled plan behavior

---

## Risks And Mitigations

- **Risk:** v2 preserves visual structure but misses a less obvious edit workflow.
  - **Mitigation:** Keep existing popovers/modals in v2 and validate planned, actual, time-off, and monthly workflows manually before deleting legacy renderer files.
- **Risk:** monthly allocation has transaction behavior currently embedded in `ResourceRow`.
  - **Mitigation:** move it into `monthly-allocation-service.ts` before wiring row rendering, then validate create/edit/delete in month-range views.
- **Risk:** existing whitebox tests assert strings inside old `Timeline.tsx`.
  - **Mitigation:** update or add v2 parity tests during the switch task, not before.
- **Risk:** two timeline implementations temporarily increase code volume.
  - **Mitigation:** keep the old renderer only until v2 is accepted, then remove legacy renderer files in the cleanup task.
- **Risk:** performance regresses if v2 lanes render too many heavy cells.
  - **Mitigation:** keep cells stateless, virtualize resource rows, and put assignment/monthly blocks in overlays calculated by pure positioning helpers.

---

## Self-Review

- Spec coverage: the plan covers new `timeline-v2`, duplicate v2 component naming, existing filters/search, toolbar tabs, weekend toggle, all resources, row expansion showing campaigns instead of deliverables, planned assignments, actual assignments, time off, monthly allocation, loading states, access states, and final switch from old timeline.
- Placeholder scan: no plan step depends on undefined "later" work; cleanup waits for explicit acceptance because deletion before acceptance would create unnecessary rollback risk.
- Type consistency: `TimelineV2ViewMode`, `TimelineV2Column`, `TimelineV2ResourceRow`, `TimelineV2Filters`, and helper names are introduced before later tasks use them.
