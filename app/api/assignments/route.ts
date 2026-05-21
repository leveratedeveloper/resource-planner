import { NextResponse } from "next/server";
import { getAssignments, createAssignment } from "@/lib/mysql-assignments/queries";
import { getSession } from "@/lib/auth/session";

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
    totalHours: mysqlAssignment.total_hours,
    allocationPercentage: mysqlAssignment.allocation_percentage,
    isTimeOff: mysqlAssignment.is_time_off,
    timeOffTypeId: mysqlAssignment.time_off_type_uuid,
    category: mysqlAssignment.category,
    isBillable: mysqlAssignment.is_billable,
    isAdjustment: mysqlAssignment.is_adjustment,
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
    // Get session and check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const projectIds = searchParams.getAll('projectIds');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const offsetNum = offset ? parseInt(offset, 10) : undefined;

    // For restricted access, force filter to current user's employee UUID
    let effectiveEmployeeId = employeeId;
    if (!session.access.can_view_all && session.employee?.uuid) {
      effectiveEmployeeId = session.employee.uuid;
      console.log('[Assignments API] Restricted access, filtering to employee:', session.employee.uuid);
    }

    const filterParams = {
      employee_uuid: effectiveEmployeeId || undefined,
      project_uuid: projectId || undefined,
      project_uuids: projectIds.length > 0 ? projectIds : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      status: status || undefined,
      limit: limitNum,
      offset: offsetNum,
    };

    // Fetch from MySQL assignments database
    const assignments = await getAssignments(filterParams) as any[];

    // Transform to frontend format
    const transformedAssignments = assignments.map(transformMySqlAssignmentToFrontend);

    return NextResponse.json({
      success: true,
      data: transformedAssignments,
      total: transformedAssignments.length,
      hasMore: limitNum
        ? transformedAssignments.length >= limitNum
        : false,
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
    // Get session and check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Plan assignments can only be created by users with full access
    // Time off can be created by users for themselves
    const isCreatingOwnTimeOff = body.isTimeOff && body.employeeId === session.employee?.uuid;
    if (!session.access.can_view_all && !isCreatingOwnTimeOff) {
      return NextResponse.json(
        { error: 'Insufficient permissions - only users with full access can create plan assignments' },
        { status: 403 }
      );
    }

    console.log('[API /assignments] Creating assignment with data:', body);

    // Transform frontend format (camelCase) to MySQL format (snake_case)
    const mysqlData = {
      employee_uuid: body.employeeId,
      project_uuid: body.projectId || null,
      task_uuid: body.taskId || null,
      start_date: body.startDate,
      end_date: body.endDate,
      hours_per_day: body.hoursPerDay || '8.00',
      total_hours: body.totalHours || null,
      allocation_percentage: body.allocationPercentage || null,
      // Convert boolean values properly for PostgreSQL (expects integer 0/1)
      is_time_off: body.isTimeOff === true || body.isTimeOff === 'true' ? 1 : 0,
      time_off_type_uuid: body.timeOffTypeId || null,
      category: body.category || null,
      is_billable: body.isBillable === false || body.isBillable === 'false' ? 0 : 1,
      is_adjustment: body.isAdjustment === true ? 1 : 0,
      status: body.status || 'confirmed',
      note: body.note || null,
      created_by_uuid: body.createdById || null,
    };

    console.log('[API /assignments] Transformed to MySQL data:', {
      ...mysqlData,
      // Log key values
      hours_per_day: mysqlData.hours_per_day,
      total_hours_input: body.totalHours,
    });

    // Create assignment in MySQL
    const result = await createAssignment(mysqlData);

    console.log('[API /assignments] Assignment created successfully:', {
      uuid: result.uuid,
      hours_per_day: result.hours_per_day,
      total_hours: result.total_hours
    });

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
