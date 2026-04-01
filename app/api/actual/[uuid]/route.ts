import { NextRequest, NextResponse } from "next/server";
import {
  getActualAssignmentById,
  updateActualAssignment,
  deleteActualAssignment,
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
 * GET /api/actual/[uuid]
 * Get a single actual assignment by UUID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const actual = await getActualAssignmentById(uuid);
    const transformedActual = transformSupabaseActualToFrontend(actual);

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
      employeeId: session.employee?.id,
      employeeName: session.employee?.fullName,
    });

    // Get the actual assignment first to check ownership
    const existingActual = await getActualAssignmentById(uuid);

    console.log('[API /actual/[uuid] PUT] Existing actual:', {
      uuid: existingActual.id,
      employeeId: existingActual.employeeId,
    });

    // Actual assignments can only be updated by the assigned employee themselves
    if (existingActual.employeeId !== session.employee?.id) {
      console.error('[API /actual/[uuid] PUT] Permission denied - user trying to update another employee\'s actual assignment', {
        actual_employee_id: existingActual.employeeId,
        session_employee_id: session.employee?.id,
      });
      return NextResponse.json(
        { error: "You can only update your own actual assignments" },
        { status: 403 }
      );
    }

    const body = await request.json();

    console.log('[API /actual/[uuid] PUT] Request body:', body);

    // Transform frontend format (camelCase with uuid suffix) to Supabase format (camelCase)
    const supabaseData: Partial<{
      startDate: string;
      endDate: string;
      hoursPerDay: string | number;
      allocationPercentage: number;
      isTimeOff: boolean;
      timeOffTypeId: string;
      category: string;
      isBillable: boolean;
      status: string;
      note: string;
      projectId: string;
      taskId: string;
    }> = {
      ...(body.startDate !== undefined && { startDate: body.startDate }),
      ...(body.endDate !== undefined && { endDate: body.endDate }),
      ...(body.hoursPerDay !== undefined && { hoursPerDay: body.hoursPerDay }),
      ...(body.allocationPercentage !== undefined && { allocationPercentage: body.allocationPercentage }),
      ...(body.isTimeOff !== undefined && { isTimeOff: body.isTimeOff }),
      ...(body.timeOffTypeUuid !== undefined && { timeOffTypeId: body.timeOffTypeUuid }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.isBillable !== undefined && { isBillable: body.isBillable }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.note !== undefined && { note: body.note }),
      ...(body.projectUuid !== undefined && { projectId: body.projectUuid }),
      ...(body.taskUuid !== undefined && { taskId: body.taskUuid }),
    };

    console.log("[API /actual/[uuid]] Updating actual assignment:", { uuid, supabaseData });

    const updatedActual = await updateActualAssignment(uuid, supabaseData);
    const transformedActual = transformSupabaseActualToFrontend(updatedActual);

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
    const existingActual = await getActualAssignmentById(uuid);

    // Actual assignments can only be deleted by the assigned employee themselves
    if (existingActual.employeeId !== session.employee?.id) {
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
