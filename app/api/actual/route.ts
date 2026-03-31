import { NextRequest, NextResponse } from "next/server";
import {
  getActualAssignments,
  createActualAssignment,
} from "@/lib/mysql-assignments/queries";
import { getSession } from "@/lib/auth/session";

/**
 * Transform MySQL actual assignment format (snake_case) to frontend format (camelCase)
 * Struktur sama dengan assignments
 */
function transformMySqlActualToFrontend(mysqlActual: any) {
  return {
    uuid: mysqlActual.uuid,
    employeeUuid: mysqlActual.employee_uuid,
    projectUuid: mysqlActual.project_uuid,
    taskUuid: mysqlActual.task_uuid,
    startDate: mysqlActual.start_date,
    endDate: mysqlActual.end_date,
    hoursPerDay: mysqlActual.hours_per_day,
    allocationPercentage: mysqlActual.allocation_percentage,
    isTimeOff: mysqlActual.is_time_off,
    timeOffTypeUuid: mysqlActual.time_off_type_uuid,
    category: mysqlActual.category || null,
    isBillable: mysqlActual.is_billable,
    status: mysqlActual.status,
    note: mysqlActual.note,
    createdByUuid: mysqlActual.created_by_uuid,
    createdAt: mysqlActual.created_at,
    updatedAt: mysqlActual.updated_at,
  };
}

/**
 * GET /api/actual
 * Fetch actual assignments from direct MySQL connection
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filters = {
      employee_uuid: searchParams.get("employee_uuid") || undefined,
      project_uuid: searchParams.get("project_uuid") || undefined,
      start_date: searchParams.get("start_date") || undefined,
      end_date: searchParams.get("end_date") || undefined,
    };

    // For restricted access, force filter to current user's employee UUID
    if (!session.access.can_view_all && session.employee?.uuid) {
      filters.employee_uuid = session.employee.uuid;
    }

    const actuals = await getActualAssignments(filters);
    const transformedActuals = (actuals as any[]).map(transformMySqlActualToFrontend);

    return NextResponse.json({
      success: true,
      data: transformedActuals,
      total: transformedActuals.length,
    });
  } catch (error) {
    console.error("[API /actual] Failed to fetch actual assignments:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch actual assignments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/actual
 * Create actual assignment via direct MySQL connection
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      console.error('[API /actual POST] No session');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    console.log('====================================');
    console.log('[API /actual POST] Session:', {
      employeeUuid: session.employee?.uuid,
      can_view_all: session.access.can_view_all,
    });
    console.log('[API /actual POST] Request body:', body);
    console.log('[API /actual POST] Permission check:', {
      can_view_all: session.access.can_view_all,
      employeeUuid_match: body.employeeUuid === session.employee?.uuid,
    });
    console.log('====================================');

    // Actual assignments can only be created by the employee themselves, regardless of access level
    if (body.employeeUuid !== session.employee?.uuid) {
      console.error('[API /actual POST] Permission denied - user trying to create actual assignment for another employee');
      return NextResponse.json(
        { error: "You can only create actual assignments for yourself" },
        { status: 403 }
      );
    }

    // Transform frontend format (camelCase) to MySQL format (snake_case)
    // Struktur sama dengan assignments
    const mysqlData = {
      employee_uuid: body.employeeUuid,
      project_uuid: body.projectUuid || null,
      task_uuid: body.taskUuid || null,
      start_date: body.startDate,
      end_date: body.endDate,
      hours_per_day: body.hoursPerDay || '8.00',
      allocation_percentage: body.allocationPercentage || null,
      is_time_off: body.isTimeOff || false,
      time_off_type_uuid: body.timeOffTypeUuid || null,
      category: body.category || null,
      is_billable: body.isBillable !== undefined ? body.isBillable : true,
      status: body.status || 'confirmed',
      note: body.note || null,
      created_by_uuid: session.employee?.uuid || null,
    };

    const result = await createActualAssignment(mysqlData);
    const transformedActual = transformMySqlActualToFrontend(result);

    console.log('[API /actual POST] Successfully created actual:', transformedActual);
    console.log('====================================');

    return NextResponse.json({
      success: true,
      data: transformedActual,
    }, { status: 201 });
  } catch (error) {
    console.error('[API /actual POST] Failed to create actual assignment:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create actual assignment" },
      { status: 500 }
    );
  }
}
