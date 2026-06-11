import { NextResponse } from 'next/server';
import { getAssignment, updateAssignment, deleteAssignment } from '@/lib/mysql-assignments/queries';
import type { MySqlAssignment } from '@/lib/types/mysql';
import { getSession } from '@/lib/auth/session';

type MySqlAssignmentRow = MySqlAssignment & {
  total_hours?: number | string | null;
};

/**
 * Transform MySQL API assignment format (snake_case) to frontend format (camelCase)
 */
function transformMySqlAssignmentToFrontend(mysqlAssignment: MySqlAssignmentRow) {
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
    status: mysqlAssignment.status,
    note: mysqlAssignment.note,
    createdById: mysqlAssignment.created_by_uuid,
    createdAt: mysqlAssignment.created_at,
    updatedAt: mysqlAssignment.updated_at,
  };
}

/**
 * GET /api/assignments/[id]
 * Get a single assignment by UUID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const assignment = await getAssignment(id);
    if (assignment.is_time_off) {
      return NextResponse.json(
        { success: false, error: 'Time-off assignments are retired' },
        { status: 410 }
      );
    }
    const transformedAssignment = transformMySqlAssignmentToFrontend(assignment);

    return NextResponse.json({
      success: true,
      data: transformedAssignment,
    });
  } catch (error) {
    console.error('[API /assignments/[id]] Failed to get assignment:', error);

    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get assignment',
      },
      { status }
    );
  }
}

/**
 * PUT /api/assignments/[id]
 * Update an assignment
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get session and check authentication + permissions
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignment = await getAssignment(id);
    if (assignment.is_time_off) {
      return NextResponse.json(
        { success: false, error: 'Time-off assignments are retired' },
        { status: 410 }
      );
    }

    // Plan assignments can only be updated by users with full access
    if (!session.access.can_view_all) {
      return NextResponse.json(
        { error: 'Insufficient permissions - only users with full access can update plan assignments' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (body.isTimeOff === true || body.isTimeOff === 'true') {
      return NextResponse.json(
        { success: false, error: 'Time-off assignments are retired' },
        { status: 410 }
      );
    }

    // Transform frontend format (camelCase) to MySQL format (snake_case)
    // Build update data, converting boolean values properly for PostgreSQL (expects integer 0/1)
    const mysqlData: Partial<{
      start_date: string;
      end_date: string;
      hours_per_day: string | number;
      total_hours: number;
      allocation_percentage: number;
      is_time_off: number;
      time_off_type_uuid: string;
      category: string;
      is_billable: number;
      status: string;
      note: string;
      project_uuid: string;
    }> = {
      ...(body.startDate !== undefined && { start_date: body.startDate }),
      ...(body.endDate !== undefined && { end_date: body.endDate }),
      ...(body.hoursPerDay !== undefined && { hours_per_day: body.hoursPerDay }),
      ...(body.totalHours !== undefined && { total_hours: body.totalHours }),
      ...(body.allocationPercentage !== undefined && { allocation_percentage: body.allocationPercentage }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.isBillable !== undefined && { is_billable: body.isBillable === false || body.isBillable === 'false' ? 0 : 1 }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.note !== undefined && { note: body.note }),
      ...(body.projectId !== undefined && { project_uuid: body.projectId }),
    };

    console.log('[API /assignments/[id]] Updating assignment:', { id, mysqlData });

    const updatedAssignment = await updateAssignment(id, mysqlData);
    const transformedAssignment = transformMySqlAssignmentToFrontend(updatedAssignment);

    return NextResponse.json({
      success: true,
      data: transformedAssignment,
    });
  } catch (error) {
    console.error('[API /assignments/[id]] Failed to update assignment:', error);

    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update assignment',
      },
      { status }
    );
  }
}

/**
 * DELETE /api/assignments/[id]
 * Delete an assignment
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get session and check authentication + permissions
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignment = await getAssignment(id);
    if (assignment.is_time_off) {
      return NextResponse.json(
        { success: false, error: 'Time-off assignments are retired' },
        { status: 410 }
      );
    }

    // Plan assignments can only be deleted by users with full access
    if (!session.access.can_view_all) {
      return NextResponse.json(
        { error: 'Insufficient permissions - only users with full access can delete plan assignments' },
        { status: 403 }
      );
    }

    console.log('[API /assignments/[id]] Deleting assignment:', id);

    await deleteAssignment(id);

    return NextResponse.json({
      success: true,
      message: 'Assignment deleted successfully',
    });
  } catch (error) {
    console.error('[API /assignments/[id]] Failed to delete assignment:', error);

    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete assignment',
      },
      { status }
    );
  }
}
