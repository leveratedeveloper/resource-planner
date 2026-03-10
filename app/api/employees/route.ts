import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const search = searchParams.get("search");

    const client = getMySqlApiClient();

    // MySQL API uses page-based pagination, convert offset to page
    const perPage = limit ? parseInt(limit, 10) : 50;
    const page = offset ? Math.floor(parseInt(offset, 10) / perPage) + 1 : 1;

    const response = await client.getEmployees({
      page,
      per_page: perPage,
      search: search || undefined,
    });

    console.log('[Employees API] Raw MySQL response:', JSON.stringify(response, null, 2));

    // Check for API errors from the client
    if (response.error) {
      console.error('[Employees API] MySQL API returned an error:', response.error);
      return NextResponse.json(
        {
          success: false,
          error: response.error.message,
          errorType: response.error.type,
          data: [],
        },
        { status: response.status === 200 ? 500 : response.status }
      );
    }

    // Handle double-wrapped response: response.data.data instead of response.data
    const actualData = response?.data?.data || response?.data || [];

    // Transform MySQL response to match expected format
    return NextResponse.json({
      success: response.success,
      data: actualData.map((emp: any) => ({
        id: emp.uuid,
        employeeNumber: emp.nik,
        fullName: emp.full_name,
        nickname: emp.nickname,
        email: null,
        photo: emp.photo,
        position: emp.position,
        departmentId: String(emp.dept_id),
        businessUnitId: null,
        directSupervisorId: emp.direct_supervisor ? String(emp.direct_supervisor) : null,
        weeklyCapacity: 40,
        workStartDate: emp.work_start_date,
        dateOfBirth: emp.dob,
        employmentStatus: emp.flag === 'active' ? 'active' : 'inactive',
        visibility: emp.status === 'visible' ? 'active' : 'archived',
        createdAt: emp.created_at,
        updatedAt: emp.updated_at,
        department: emp.department ? {
          id: String(emp.department.id),
          name: emp.department.department_name,
          businessUnitId: null,
          code: null,
          color: '#' + Math.floor(Math.random()*16777215).toString(16),
          description: null,
          isActive: true,
          createdAt: emp.created_at,
          updatedAt: emp.updated_at,
        } : undefined,
        businessUnit: null,
        supervisor: emp.supervisor ? {
          id: emp.supervisor.uuid,
          fullName: emp.supervisor.full_name,
          nickname: null,
          email: null,
          photo: null,
          position: emp.supervisor.position,
          departmentId: null,
          businessUnitId: null,
          directSupervisorId: null,
          weeklyCapacity: 40,
          workStartDate: null,
          dateOfBirth: null,
          employmentStatus: 'active' as const,
          visibility: 'active' as const,
          createdAt: emp.created_at,
          updatedAt: emp.updated_at,
        } : undefined,
      })),
      total: (response?.data?.meta || response?.meta)?.total || actualData.length,
      hasMore: (response?.data?.meta || response?.meta) ? (response?.data?.meta || response?.meta).current_page < (response?.data?.meta || response?.meta).last_page : false,
    });
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch employees",
        data: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, error: "Creating employees via MySQL API not yet implemented" },
    { status: 501 }
  );
}
