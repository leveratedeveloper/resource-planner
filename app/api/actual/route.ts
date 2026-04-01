import { NextRequest, NextResponse } from "next/server";
import {
  getActualAssignmentsByEmployee,
  getActualAssignmentsByProject,
  getActualAssignmentsByDateRange,
  getAllActualAssignments,
  createActualAssignment,
} from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";

/**
 * Transform Supabase actual assignment format (camelCase) to frontend format (camelCase with uuid suffix)
 * This maintains compatibility with the existing frontend API
 */
function transformSupabaseActualToFrontend(actual: any) {
  return {
    uuid: actual.id,
    employeeUuid: actual.employeeId,
    projectUuid: actual.projectId,
    taskUuid: actual.taskId,
    startDate: actual.startDate,
    endDate: actual.endDate,
    hoursPerDay: actual.hoursPerDay,
    allocationPercentage: actual.allocationPercentage,
    isTimeOff: actual.isTimeOff,
    timeOffTypeUuid: actual.timeOffTypeId,
    category: actual.category || null,
    isBillable: actual.isBillable,
    status: actual.status,
    note: actual.note,
    createdByUuid: actual.createdById,
    createdAt: actual.createdAt,
    updatedAt: actual.updatedAt,
  };
}

/**
 * GET /api/actual
 * Fetch actual assignments from Supabase
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employee_uuid") || undefined;
    const projectId = searchParams.get("project_uuid") || undefined;
    const startDate = searchParams.get("start_date") || undefined;
    const endDate = searchParams.get("end_date") || undefined;

    let actuals;

    // For restricted access, force filter to current user's employee ID
    if (!session.access.can_view_all && session.employee?.id) {
      actuals = await getActualAssignmentsByEmployee(session.employee.id);
    } else if (employeeId) {
      actuals = await getActualAssignmentsByEmployee(employeeId);
    } else if (projectId) {
      actuals = await getActualAssignmentsByProject(projectId);
    } else if (startDate && endDate) {
      actuals = await getActualAssignmentsByDateRange(startDate, endDate);
    } else {
      actuals = await getAllActualAssignments();
    }

    const transformedActuals = actuals.map(transformSupabaseActualToFrontend);

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
 * Create actual assignment via Supabase
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
      employeeId: session.employee?.id,
      can_view_all: session.access.can_view_all,
    });
    console.log('[API /actual POST] Request body:', body);
    console.log('[API /actual POST] Permission check:', {
      can_view_all: session.access.can_view_all,
      employeeUuid_match: body.employeeUuid === session.employee?.id,
    });
    console.log('====================================');

    // Actual assignments can only be created by the employee themselves, regardless of access level
    if (body.employeeUuid !== session.employee?.id) {
      console.error('[API /actual POST] Permission denied - user trying to create actual assignment for another employee');
      return NextResponse.json(
        { error: "You can only create actual assignments for yourself" },
        { status: 403 }
      );
    }

    // Transform frontend format (camelCase with uuid suffix) to Supabase format (camelCase)
    const supabaseData = {
      employeeId: body.employeeUuid,
      projectId: body.projectUuid || null,
      taskId: body.taskUuid || null,
      startDate: body.startDate,
      endDate: body.endDate,
      hoursPerDay: body.hoursPerDay || '8.00',
      allocationPercentage: body.allocationPercentage || null,
      isTimeOff: body.isTimeOff || false,
      timeOffTypeId: body.timeOffTypeUuid || null,
      category: body.category || null,
      isBillable: body.isBillable !== undefined ? body.isBillable : true,
      status: body.status || 'completed',
      note: body.note || null,
      createdById: session.employee?.id || null,
    };

    const result = await createActualAssignment(supabaseData);
    const transformedActual = transformSupabaseActualToFrontend(result);

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
