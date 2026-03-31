import { NextRequest, NextResponse } from "next/server";
import {
  getActual,
  updateActualAssignment,
  deleteActualAssignment,
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
 * GET /api/actual/[uuid]
 * Get a single actual assignment by UUID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const actual = await getActual(uuid);
    const transformedActual = transformMySqlActualToFrontend(actual);

    return NextResponse.json({
      success: true,
      data: transformedActual,
    });
  } catch (error) {
    console.error("[API /actual/[uuid]] Failed to get actual assignment:", error);

    const status = error instanceof Error && error.message.includes("not found") ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get actual assignment",
      },
      { status }
    );
  }
}

/**
 * PUT /api/actual/[uuid]
 * Update an actual assignment
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;

    console.log('[API /actual/[uuid] PUT] Starting update for UUID:', uuid);

    // Get the session
    const session = await getSession();
    if (!session) {
      console.error('[API /actual/[uuid] PUT] No session found');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('[API /actual/[uuid] PUT] Session found:', {
      employeeUuid: session.employee?.uuid,
      employeeName: session.employee?.name,
    });

    // Get the actual assignment first to check ownership
    const existingActual = await getActual(uuid);

    console.log('[API /actual/[uuid] PUT] Existing actual:', {
      uuid: existingActual.uuid,
      employee_uuid: existingActual.employee_uuid,
    });

    // Actual assignments can only be updated by the assigned employee themselves
    if (existingActual.employee_uuid !== session.employee?.uuid) {
      console.error('[API /actual/[uuid] PUT] Permission denied - user trying to update another employee\'s actual assignment', {
        actual_employee_uuid: existingActual.employee_uuid,
        session_employee_uuid: session.employee?.uuid,
      });
      return NextResponse.json(
        { error: "You can only update your own actual assignments" },
        { status: 403 }
      );
    }

    const body = await request.json();

    console.log('[API /actual/[uuid] PUT] Request body:', body);

    // Transform frontend format (camelCase) to MySQL format (snake_case)
    // Struktur sama dengan assignments
    const mysqlData: Partial<{
      start_date: string;
      end_date: string;
      hours_per_day: string | number;
      allocation_percentage: number;
      is_time_off: boolean;
      time_off_type_uuid: string;
      category: string;
      is_billable: boolean;
      status: string;
      note: string;
      project_uuid: string;
      task_uuid: string;
    }> = {
      ...(body.startDate !== undefined && { start_date: body.startDate }),
      ...(body.endDate !== undefined && { end_date: body.endDate }),
      ...(body.hoursPerDay !== undefined && { hours_per_day: body.hoursPerDay }),
      ...(body.allocationPercentage !== undefined && { allocation_percentage: body.allocationPercentage }),
      ...(body.isTimeOff !== undefined && { is_time_off: body.isTimeOff }),
      ...(body.timeOffTypeUuid !== undefined && { time_off_type_uuid: body.timeOffTypeUuid }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.isBillable !== undefined && { is_billable: body.isBillable }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.note !== undefined && { note: body.note }),
      ...(body.projectUuid !== undefined && { project_uuid: body.projectUuid }),
      ...(body.taskUuid !== undefined && { task_uuid: body.taskUuid }),
    };

    console.log("[API /actual/[uuid]] Updating actual assignment:", { uuid, mysqlData });

    const updatedActual = await updateActualAssignment(uuid, mysqlData);
    const transformedActual = transformMySqlActualToFrontend(updatedActual);

    return NextResponse.json({
      success: true,
      data: transformedActual,
    });
  } catch (error) {
    console.error("[API /actual/[uuid]] Failed to update actual assignment:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });

    const status = error instanceof Error && error.message.includes("not found") ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update actual assignment",
      },
      { status }
    );
  }
}

/**
 * DELETE /api/actual/[uuid]
 * Delete an actual assignment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;

    // Get the session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the actual assignment first to check ownership
    const existingActual = await getActual(uuid);

    // Actual assignments can only be deleted by the assigned employee themselves
    if (existingActual.employee_uuid !== session.employee?.uuid) {
      console.error('[API /actual/[uuid] DELETE] Permission denied - user trying to delete another employee\'s actual assignment');
      return NextResponse.json(
        { error: "You can only delete your own actual assignments" },
        { status: 403 }
      );
    }

    console.log("[API /actual/[uuid]] Deleting actual assignment:", uuid);

    await deleteActualAssignment(uuid);

    return NextResponse.json({
      success: true,
      message: "Actual assignment deleted successfully",
    });
  } catch (error) {
    console.error("[API /actual/[uuid]] Failed to delete actual assignment:", error);

    const status = error instanceof Error && error.message.includes("not found") ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete actual assignment",
      },
      { status }
    );
  }
}
