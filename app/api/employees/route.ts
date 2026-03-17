import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";

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
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const search = searchParams.get("search");

    // Get API client with session token
    const client = getMySqlApiClient(async () => session.access_token);

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
    let actualData = response?.data?.data || response?.data || [];

    // Debug: Log all fields to find a match
    console.log('[Employees API] Session employee full data:', session.employee);
    console.log('[Employees API] MySQL employees (first 3):', actualData.slice(0, 3).map((e: any) => ({
      uuid: e.uuid,
      nik: e.nik,
      full_name: e.full_name,
      email: e.email,
    })));

    // Apply access level filtering
    // If user has restricted access, only show their own employee record
    if (!session.access.can_view_all) {
      // Try multiple matching strategies in current page
      let match = actualData.find((emp: any) => {
        // Try matching by UUID (from MySQL API)
        if (emp.uuid === session.employee?.uuid) return true;
        // Try matching by NIK
        if (emp.nik === session.employee?.nik) return true;
        // Try matching by full_name
        if (emp.full_name === session.employee?.full_name) return true;
        return false;
      });

      // If not found in current page, search specifically for this employee
      if (!match && (session.employee?.nik || session.employee?.full_name)) {
        console.log('[Employees API] Not in current page, searching by NIK/name...');
        try {
          const searchQuery = session.employee.nik || session.employee.full_name;
          const searchResponse = await client.getEmployees({
            page: 1,
            per_page: 100,
            search: searchQuery
          });

          const searchData = searchResponse?.data?.data || searchResponse?.data || [];
          match = searchData.find((emp: any) => {
            if (emp.uuid === session.employee?.uuid) return true;
            if (emp.nik === session.employee?.nik) return true;
            if (emp.full_name === session.employee?.full_name) return true;
            return false;
          });

          if (match) {
            console.log('[Employees API] Found via search:', match.full_name, '(' + match.nik + ')');
          } else {
            console.log('[Employees API] Still not found after search for:', searchQuery);
          }
        } catch (searchError) {
          console.error('[Employees API] Search failed:', searchError);
        }
      } else if (match) {
        console.log('[Employees API] Found in current page:', match.full_name);
      }

      actualData = match ? [match] : [];
    } else {
      console.log('[Employees API] Full access granted, showing all employees');
    }

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
      // Update total count after filtering
      total: actualData.length,
      // No more pages when filtered to own data
      hasMore: false,
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
  // Check authentication
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Check authorization - only full access users can create employees
  if (!session.access.can_view_all) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { success: false, error: "Creating employees via MySQL API not yet implemented" },
    { status: 501 }
  );
}
