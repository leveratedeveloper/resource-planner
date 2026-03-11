import { NextResponse } from "next/server";

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
    // Transform relations
    employee: mysqlAssignment.employee ? {
      id: mysqlAssignment.employee.uuid,
      fullName: mysqlAssignment.employee.full_name,
      position: mysqlAssignment.employee.position,
      department: mysqlAssignment.employee.department ? {
        id: String(mysqlAssignment.employee.department.id),
        name: mysqlAssignment.employee.department.department_name,
        color: '#6366f1',
      } : undefined,
    } : undefined,
    project: mysqlAssignment.project ? {
      id: mysqlAssignment.project.uuid,
      name: mysqlAssignment.project.name,
      color: mysqlAssignment.project.color,
      brand: mysqlAssignment.project.brand ? {
        id: mysqlAssignment.project.brand.uuid,
        name: mysqlAssignment.project.brand.brand_name,
        color: '#6366f1',
      } : undefined,
    } : undefined,
    createdBy: mysqlAssignment.created_by ? {
      id: mysqlAssignment.created_by.uuid,
      fullName: mysqlAssignment.created_by.full_name,
    } : undefined,
  };
}

/**
 * GET /api/assignments
 * Fetch assignments from MySQL API
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query params for mysql-bridge
    const bridgeParams = new URLSearchParams();
    if (employeeId) bridgeParams.set('employee_uuid', employeeId);
    if (projectId) bridgeParams.set('project_uuid', projectId);
    if (startDate) bridgeParams.set('start_date', startDate);
    if (endDate) bridgeParams.set('end_date', endDate);

    // Call mysql-bridge endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mysql-bridge/assignments${bridgeParams.toString() ? '?' + bridgeParams.toString() : ''}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: errorData.error || 'Failed to fetch assignments' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform MySQL API response to frontend format
    const transformedAssignments = (data.data || []).map(transformMySqlAssignmentToFrontend);

    return NextResponse.json({
      success: true,
      data: transformedAssignments,
      total: transformedAssignments.length,
      hasMore: false,
    });
  } catch (error) {
    console.error("Failed to fetch assignments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assignments
 * Create assignment via MySQL API
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Transform frontend format (camelCase) to MySQL API format (snake_case)
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

    console.log('[API /assignments] Creating assignment with data:', mysqlData);

    // Call mysql-bridge endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mysql-bridge/assignments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mysqlData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[API /assignments] Error response:', errorData);
      return NextResponse.json(
        { success: false, error: errorData.error || 'Failed to create assignment' },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Transform MySQL API response back to frontend format
    const transformedAssignment = transformMySqlAssignmentToFrontend(result.data);

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
