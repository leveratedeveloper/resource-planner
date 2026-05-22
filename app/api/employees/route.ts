import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";
import { sortEmployeeRecordsByName } from "@/lib/timeline/employees";

const UPSTREAM_EMPLOYEE_PAGE_SIZE = 100;

type TimetrackEmployeeRecord = {
  uuid?: string;
  nik?: string;
  full_name?: string;
  nickname?: string | null;
  photo?: string | null;
  position?: string;
  dept_id?: string | number;
  direct_supervisor?: string | number | null;
  work_start_date?: string | null;
  dob?: string | null;
  flag?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  department?: {
    id?: string | number;
    department_name?: string;
  };
  supervisor?: {
    uuid?: string;
    full_name?: string;
    position?: string;
  };
};

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

    const perPage = limit ? parseInt(limit, 10) : 50;
    const requestedOffset = offset ? parseInt(offset, 10) : 0;

    const firstResponse = await client.getEmployees({
      page: 1,
      per_page: UPSTREAM_EMPLOYEE_PAGE_SIZE,
      search: search || undefined,
    });

    // Check for API errors from the client
    if (firstResponse.error) {
      console.error('[Employees API] MySQL API returned an error:', firstResponse.error);
      return NextResponse.json(
        {
          success: false,
          error: firstResponse.error.message,
          errorType: firstResponse.error.type,
          data: [],
        },
        { status: firstResponse.status === 200 ? 500 : firstResponse.status }
      );
    }

    // Handle double-wrapped response: response.data.data instead of response.data
    const firstPageData = (firstResponse?.data?.data || firstResponse?.data || []) as TimetrackEmployeeRecord[];
    const firstMeta = firstResponse?.data?.meta || firstResponse?.meta || {};
    const lastPage = firstMeta.last_page || 1;

    const remainingResponses = await Promise.all(
      Array.from({ length: Math.max(0, lastPage - 1) }, (_, index) =>
        client.getEmployees({
          page: index + 2,
          per_page: UPSTREAM_EMPLOYEE_PAGE_SIZE,
          search: search || undefined,
        })
      )
    );

    const remainingData = remainingResponses.flatMap((employeeResponse): TimetrackEmployeeRecord[] =>
      employeeResponse?.error
        ? []
        : (employeeResponse?.data?.data || employeeResponse?.data || []) as TimetrackEmployeeRecord[]
    );

    let actualData = sortEmployeeRecordsByName([...firstPageData, ...remainingData]);

    // Apply access level filtering
    // If user has restricted access, only show their own employee record
    if (!session.access.can_view_all) {
      // Try multiple matching strategies in current page
      let match = actualData.find((emp) => {
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
        try {
          const searchQuery = session.employee.nik || session.employee.full_name;
          const searchResponse = await client.getEmployees({
            page: 1,
            per_page: 100,
            search: searchQuery
          });

          const searchData = (searchResponse?.data?.data || searchResponse?.data || []) as TimetrackEmployeeRecord[];
          match = searchData.find((emp) => {
            if (emp.uuid === session.employee?.uuid) return true;
            if (emp.nik === session.employee?.nik) return true;
            if (emp.full_name === session.employee?.full_name) return true;
            return false;
          });

        } catch (searchError) {
          console.error('[Employees API] Search failed:', searchError);
        }
      }

      actualData = match ? [match] : [];
    }

    const mysqlTotal = actualData.length;
    const paginatedData = actualData.slice(requestedOffset, requestedOffset + perPage);

    // Transform MySQL response to match expected format
    return NextResponse.json({
      success: firstResponse.success,
      data: paginatedData.map((emp) => ({
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
      // Use MySQL total count for full access, filtered count for restricted access
      total: !session.access.can_view_all ? actualData.length : mysqlTotal,
      // Check if there are more pages (only relevant for full access)
      hasMore: !session.access.can_view_all ? false : requestedOffset + perPage < mysqlTotal,
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

export async function POST() {
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
