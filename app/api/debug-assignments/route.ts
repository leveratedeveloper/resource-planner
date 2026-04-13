import { NextResponse } from "next/server";
import { assignmentsDb, testConnection } from "@/lib/mysql-assignments/db";
import { getAssignments } from "@/lib/mysql-assignments/queries";

/**
 * DEBUG API - Check assignments in database
 * GET /api/debug-assignments
 */
export async function GET(request: Request) {
  const results: any = {
    database: {},
    assignments: [],
    errors: []
  };

  try {
    // 1. Test database connection
    results.database.connected = await testConnection();
    results.database.config = {
      host: process.env.MYSQL_ASSIGNMENTS_HOST || '127.0.0.1',
      port: process.env.MYSQL_ASSIGNMENTS_PORT || '3306',
      database: process.env.MYSQL_ASSIGNMENTS_DATABASE || 'resource_planner_assignments',
    };

    if (!results.database.connected) {
      results.errors.push('Database connection failed');
      return NextResponse.json(results);
    }

    // 2. Count all assignments
    const [countResult] = await assignmentsDb.execute(
      'SELECT COUNT(*) as total FROM assignments'
    ) as any[];
    results.database.totalAssignments = countResult[0]?.total || 0;

    // 3. Get all assignments without filters
    const [allAssignments] = await assignmentsDb.execute(
      'SELECT * FROM assignments ORDER BY created_at DESC LIMIT 10'
    ) as any[];
    results.assignments = allAssignments;

    // 4. Check distinct statuses
    const [statusResult] = await assignmentsDb.execute(
      'SELECT DISTINCT status, COUNT(*) as count FROM assignments GROUP BY status'
    ) as any[];
    results.database.statusBreakdown = statusResult;

    // 5. Check date ranges of assignments
    const [dateRange] = await assignmentsDb.execute(`
      SELECT
        MIN(start_date) as earliest_start,
        MAX(end_date) as latest_end,
        MIN(created_at) as first_created,
        MAX(created_at) as last_created
      FROM assignments
    `) as any[];
    results.database.dateRange = dateRange[0];

    // 6. If date params provided, test with those filters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const employeeId = searchParams.get('employeeId');
    const projectId = searchParams.get('projectId');

    if (startDate || endDate || employeeId || projectId) {
      const filtered = await getAssignments({
        employee_uuid: employeeId || undefined,
        project_uuid: projectId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      results.filteredAssignments = filtered;
      results.filtersApplied = { startDate, endDate, employeeId, projectId };
    }

  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : String(error));
  }

  return NextResponse.json(results);
}
