import { NextResponse } from "next/server";
import { getAssignments, createAssignment } from "@/lib/mysql-assignments/queries";

/**
 * Transform MySQL API assignment format (snake_case) to frontend format (camelCase)
 */
function transformMySqlAssignmentToFrontend(mysqlAssignment: any) {
  return {
    id: mysqlAssignment.uuid,
    employeeId: mysqlAssignment.employee_uuid,
    projectId: mysqlAssignment.project_uuid,
    taskId: mysqlAssignment.task_uuid,
    startDate: mysqlAssignment.start_date,
    endDate: mysqlAssignment.end_date,
    hoursPerDay: mysqlAssignment.hours_per_day,
    allocationPercentage: mysqlAssignment.allocation_percentage,
    isTimeOff: mysqlAssignment.is_time_off,
    timeOffTypeId: mysqlAssignment.time_off_type_uuid,
    category: mysqlAssignment.category,
    isBillable: mysqlAssignment.is_billable,
    status: mysqlAssignment.status,
    note: mysqlAssignment.note,
    createdById: mysqlAssignment.created_by_uuid,
    createdAt: mysqlAssignment.created_at,
    updatedAt: mysqlAssignment.updated_at,
  };
}

/**
 * GET /api/assignments
 * Fetch assignments from direct MySQL connection
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    // Fetch from MySQL assignments database
    const assignments = await getAssignments({
      employee_uuid: employeeId || undefined,
      project_uuid: projectId || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      status: status || undefined,
    }) as any[];

    // Transform to frontend format
    const transformedAssignments = assignments.map(transformMySqlAssignmentToFrontend);

    return NextResponse.json({
      success: true,
      data: transformedAssignments,
      total: transformedAssignments.length,
      hasMore: false,
    });
  } catch (error) {
    console.error("[API /assignments] Failed to fetch assignments:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assignments
 * Create assignment via direct MySQL connection
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log('[API /assignments] Creating assignment with data:', body);

    // Transform frontend format (camelCase) to MySQL format (snake_case)
    const mysqlData = {
      employee_uuid: body.employeeId,
      project_uuid: body.projectId || null,
      task_uuid: body.taskId || null,
      start_date: body.startDate,
      end_date: body.endDate,
      hours_per_day: body.hoursPerDay || '8.00',
      allocation_percentage: body.allocationPercentage || null,
      is_time_off: body.isTimeOff ?? false,
      time_off_type_uuid: body.timeOffTypeId || null,
      category: body.category || null,
      is_billable: body.isBillable ?? true,
      status: body.status || 'confirmed',
      note: body.note || null,
      created_by_uuid: body.createdById || null,
    };

    // Create assignment in MySQL
    const result = await createAssignment(mysqlData);

    // Transform back to frontend format
    const transformedAssignment = transformMySqlAssignmentToFrontend(result);

    return NextResponse.json({
      success: true,
      data: transformedAssignment,
    });
  } catch (error) {
    console.error('[API /assignments] Failed to create assignment:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create assignment' },
      { status: 500 }
    );
  }
}
