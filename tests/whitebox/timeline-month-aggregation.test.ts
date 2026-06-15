import { describe, expect, it } from "vitest";
import {
  buildMonthlyActualAggregateQuery,
  buildMonthlyAssignmentAggregateQuery,
  buildWeekdayCountExpr,
} from "@/lib/mysql-assignments/queries";
import {
  buildMonthlyAssignmentBlocksFromAggregates,
  buildMonthlyActualBlocksFromAggregates,
  summarizeMonthlyAssignments,
} from "@/lib/planner/planner-loading";
import type { Assignment } from "@/lib/query/hooks/useAssignments";

// ---------------------------------------------------------------------------
// Weekday formula: the SQL expression computes weekdays(d1..d2) as
// f(d2) - f(d1 - 1day) where f(d) = 5*floor(m/7) + least(m mod 7, 5) over
// m = days since 1900-01-01 (a Monday) + 1, floored at 1. The TS mirror below
// implements the same arithmetic; brute force is the ground truth. If these
// diverge, month block totals are silently wrong for spans crossing weekends.

const MONDAY_EPOCH = Date.UTC(1900, 0, 1);

function weekdaysFromEpochFormula(date: Date): number {
  const days = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - MONDAY_EPOCH) / 86_400_000);
  const m = days + 1;
  return 5 * Math.floor(m / 7) + Math.min(m % 7, 5);
}

function weekdayCountFormula(start: Date, end: Date): number {
  const dayBeforeStart = new Date(start);
  dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
  return Math.max(weekdaysFromEpochFormula(end) - weekdaysFromEpochFormula(dayBeforeStart), 1);
}

// Ground truth: mirrors countWeekdays in lib/planner/planner-loading.ts.
function weekdayCountBruteForce(start: Date, end: Date): number {
  let weekdays = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) weekdays += 1;
    current.setDate(current.getDate() + 1);
  }
  return Math.max(weekdays, 1);
}

describe("weekday count closed form", () => {
  it("matches brute force across every start-weekday × span combination", () => {
    // 2026-06-01 is a Monday; 14 consecutive starts × spans 0..30 days covers
    // every (start weekday, end weekday, partial week) combination.
    for (let startOffset = 0; startOffset < 14; startOffset += 1) {
      for (let span = 0; span <= 30; span += 1) {
        const start = new Date(2026, 5, 1 + startOffset);
        const end = new Date(2026, 5, 1 + startOffset);
        end.setDate(end.getDate() + span);
        expect(weekdayCountFormula(start, end), `start+${startOffset} span ${span}`).toBe(
          weekdayCountBruteForce(start, end)
        );
      }
    }
  });

  it("floors weekend-only spans at 1, like countWeekdays", () => {
    // 2026-06-06/07 is a Sat/Sun pair
    expect(weekdayCountFormula(new Date(2026, 5, 6), new Date(2026, 5, 7))).toBe(1);
    expect(weekdayCountBruteForce(new Date(2026, 5, 6), new Date(2026, 5, 7))).toBe(1);
  });

  it("emits the same arithmetic into SQL with the floor", () => {
    const expr = buildWeekdayCountExpr("postgresql", "a.start_date", "a.end_date");
    expect(expr).toContain("GREATEST(");
    expect(expr).toContain("DATE '1900-01-01'");
    expect(expr).toContain("LEAST(MOD(");
    expect(expr.endsWith(", 1)")).toBe(true);

    const mysqlExpr = buildWeekdayCountExpr("mysql", "a.start_date", "a.end_date");
    expect(mysqlExpr).toContain("DATEDIFF(");
    expect(mysqlExpr).toContain("DATE_SUB(a.start_date, INTERVAL 1 DAY)");
  });
});

// ---------------------------------------------------------------------------
// Query builders: the param array must match the `?` order in the SQL text —
// the dialect converter renumbers positionally, so a mismatch silently binds
// wrong dates.

describe("monthly aggregate query builders", () => {
  const filters = {
    start_date: "2026-04-01",
    end_date: "2026-06-30",
    employee_uuids: ["e1", "e2"],
    status: "confirmed",
    category: null,
  };

  it("binds range params in textual order for both dialects", () => {
    for (const dialect of ["postgresql", "mysql"] as const) {
      const { sql, params } = buildMonthlyAssignmentAggregateQuery(dialect, filters);
      const placeholders = (sql.match(/\?/g) || []).length;
      expect(placeholders).toBe(params.length);
      expect(params).toEqual([
        "2026-04-01", "2026-06-30",
        "2026-04-01", "2026-06-30",
        "2026-04-01", "2026-06-30",
        "e1", "e2",
        "confirmed",
      ]);
    }
  });

  it("groups by the summarize key columns and scopes employees on the aliased table", () => {
    const { sql } = buildMonthlyAssignmentAggregateQuery("postgresql", filters);
    expect(sql).toContain(
      "GROUP BY a.employee_uuid, a.project_uuid, m.month_start, a.note, a.category, a.status, a.is_billable, a.is_adjustment"
    );
    expect(sql).toContain("a.employee_uuid IN (?,?)");
    // ::integer keeps the predicate valid whether is_time_off is integer (live)
    // or boolean (schema file) on Postgres.
    expect(sql).toContain("COALESCE(a.is_time_off::integer, 0) = 0");
    expect(sql).toContain("CASE WHEN a.total_hours IS NOT NULL");
  });

  it("emits the integer-cast time-off predicate only for Postgres", () => {
    const pg = buildMonthlyAssignmentAggregateQuery("postgresql", filters).sql;
    const mysql = buildMonthlyAssignmentAggregateQuery("mysql", filters).sql;
    expect(pg).toContain("COALESCE(a.is_time_off::integer, 0) = 0");
    expect(mysql).toContain("COALESCE(a.is_time_off, 0) = 0");
    expect(mysql).not.toContain("::integer");
  });

  it("actuals variant keys without adjustment and uses hours_per_day directly", () => {
    const { sql, params } = buildMonthlyActualAggregateQuery("postgresql", filters);
    expect(sql).toContain("FROM actual a");
    expect(sql).toContain(
      "GROUP BY a.employee_uuid, a.project_uuid, m.month_start, a.note, a.category, a.status, a.is_billable"
    );
    expect(sql).not.toContain("is_adjustment");
    expect(sql).toContain("SUM(a.hours_per_day *");
    expect((sql.match(/\?/g) || []).length).toBe(params.length);
  });
});

// ---------------------------------------------------------------------------
// Block shaping: aggregate rows must produce the SAME block ids the TS
// summarize path produces — the client's month-editor detection and optimistic
// patching key off the `planner-month:` id scheme.

function makeAssignment(overrides: Partial<Assignment>): Assignment {
  return {
    id: "raw-1",
    employeeId: "emp-1",
    projectId: "proj-1",
    taskId: null,
    startDate: "2026-04-06",
    endDate: "2026-04-10",
    hoursPerDay: "2",
    totalHours: null,
    allocationPercentage: null,
    isTimeOff: false,
    timeOffTypeId: null,
    category: "Development",
    isBillable: true,
    isAdjustment: false,
    status: "confirmed",
    note: null,
    createdById: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("aggregate block shaping", () => {
  it("produces the same id, dates, and totals as the TS summarize path", () => {
    // one Mon–Fri assignment, 2h/day → 10h in April
    const tsBlocks = summarizeMonthlyAssignments([makeAssignment({})], {
      startDate: "2026-04-01",
      endDate: "2026-06-30",
    });
    const sqlBlocks = buildMonthlyAssignmentBlocksFromAggregates([
      {
        employeeUuid: "emp-1",
        projectUuid: "proj-1",
        monthStart: "2026-04-01",
        note: null,
        category: "Development",
        status: "confirmed",
        isBillable: true,
        isAdjustment: false,
        totalHours: 10,
        detailCount: 1,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);

    expect(sqlBlocks).toHaveLength(1);
    expect(tsBlocks).toHaveLength(1);
    expect(sqlBlocks[0].id).toBe(tsBlocks[0].id);
    expect(sqlBlocks[0].startDate).toBe(tsBlocks[0].startDate);
    expect(sqlBlocks[0].endDate).toBe(tsBlocks[0].endDate);
    expect(sqlBlocks[0].totalHours).toBe(tsBlocks[0].totalHours);
    expect(sqlBlocks[0].hoursPerDay).toBe(tsBlocks[0].hoursPerDay);
    expect(sqlBlocks[0].detailCount).toBe(tsBlocks[0].detailCount);
    expect(sqlBlocks[0].resolution).toBe("month");
  });

  it("merges raw-status groups that normalize to the same key", () => {
    const base = {
      employeeUuid: "emp-1",
      projectUuid: "proj-1",
      monthStart: "2026-04-01",
      note: null,
      category: null,
      isBillable: true,
      isAdjustment: false,
      detailCount: 2,
      createdAt: "x",
      updatedAt: "x",
    };
    const blocks = buildMonthlyAssignmentBlocksFromAggregates([
      { ...base, status: "confirmed", totalHours: 10 },
      // unknown raw status normalizes to "confirmed" → same key → merge
      { ...base, status: "legacy-status", totalHours: 5 },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].status).toBe("confirmed");
    expect(blocks[0].totalHours).toBe(15);
    expect(blocks[0].detailCount).toBe(4);
  });

  it("shapes actual blocks with month-average hoursPerDay and no adjustment segment", () => {
    const blocks = buildMonthlyActualBlocksFromAggregates([
      {
        employeeUuid: "emp-1",
        projectUuid: "proj-1",
        monthStart: "2026-04-01",
        note: null,
        category: null,
        status: "approved",
        isBillable: true,
        monthHours: 44,
        detailCount: 3,
        createdAt: "x",
        updatedAt: "x",
      },
    ]);

    expect(blocks).toHaveLength(1);
    // April 2026 has 22 weekdays → 44h / 22 = 2h/day
    expect(blocks[0].hoursPerDay).toBe(2);
    expect(blocks[0].uuid).toBe(
      "planner-month:emp-1:proj-1:2026-04-01:::approved:billable:work"
    );
    expect(blocks[0].detailCount).toBe(3);
  });
});
