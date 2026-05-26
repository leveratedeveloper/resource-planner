import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

type RawEmployee = {
  uuid?: string;
  nik?: string;
  full_name?: string;
  nickname?: string;
  photo?: string | null;
  position?: string;
  dept_id?: string | number | null;
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

type PaginationMeta = {
  total?: number;
  current_page?: number;
  last_page?: number;
};

type EmployeeApiResponse = {
  data?: RawEmployee[] | {
    data?: RawEmployee[];
    meta?: PaginationMeta;
  };
  meta?: PaginationMeta;
  success?: boolean;
  error?: {
    message?: string;
    type?: string;
  };
  status?: number;
};

let employeesCache: {
  data: unknown[];
  total: number;
  timestamp: number;
} | null = null;

const CACHE_TTL = 1 * 60 * 1000;

function extractEmployees(response: EmployeeApiResponse): RawEmployee[] {
  if (Array.isArray(response.data)) {
    return response.data;
  }

  return response.data?.data || [];
}

function extractMeta(response: EmployeeApiResponse): PaginationMeta {
  if (response.data && !Array.isArray(response.data)) {
    return response.data.meta || response.meta || {};
  }

  return response.meta || {};
}

export async function GET(request: Request) {
  const timing = createRequestTiming("employees_api");

  try {
    // Get session and check authentication
    const session = await getSession();
    if (!session) {
      timing.total({ result: "unauthenticated" });
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const search = searchParams.get("search");
    const useCache = session.access.can_view_all && !search && !limit && !offset;

    if (useCache && employeesCache && Date.now() - employeesCache.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: employeesCache.data,
        total: employeesCache.total,
        hasMore: false,
      });
    }

    // Get API client with session token
    const client = getMySqlApiClient(async () => session.access_token);

    // MySQL API uses page-based pagination, convert offset to page
    const perPage = limit ? parseInt(limit, 10) : 1000;
    const page = offset ? Math.floor(parseInt(offset, 10) / perPage) + 1 : 1;

    const response = await client.getEmployees({
      page,
      per_page: perPage,
      search: search || undefined,
    }) as EmployeeApiResponse;

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
    let actualData = extractEmployees(response);

    // Get pagination metadata from MySQL response
    const meta = extractMeta(response);
    const currentPage = meta.current_page || page;
    const lastPage = meta.last_page || 1;

    if (session.access.can_view_all && !search && !limit && !offset && currentPage < lastPage) {
      const remainingPages = Array.from(
        { length: lastPage - currentPage },
        (_, index) => currentPage + index + 1
      );

      const remainingResponses = await Promise.all(
        remainingPages.map((nextPage) =>
          client.getEmployees({
            page: nextPage,
            per_page: perPage,
          }) as Promise<EmployeeApiResponse>
        )
      );

      actualData = [
        ...actualData,
        ...remainingResponses.flatMap((pageResponse) => {
          if (pageResponse.error) {
            console.error('[Employees API] Failed to fetch employee page:', pageResponse.error);
            return [];
          }

          return extractEmployees(pageResponse);
        }),
      ];
    }

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
        console.log('[Employees API] Not in current page, searching by NIK/name...');
        try {
          const searchQuery = session.employee.nik || session.employee.full_name;
          const searchResponse = await client.getEmployees({
            page: 1,
            per_page: 100,
            search: searchQuery
          }) as EmployeeApiResponse;

          const searchData = extractEmployees(searchResponse);
          match = searchData.find((emp) => {
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

    const mysqlTotal = meta.total || actualData.length;

    console.log('[Employees API] Fetched employees:', {
      count: actualData.length,
      page: currentPage,
      perPage,
      search: Boolean(search),
      restricted: !session.access.can_view_all,
      pages: lastPage,
    });

    const transformedEmployees = actualData.map((emp) => ({
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
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
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
    }));

    if (useCache) {
      employeesCache = {
        data: transformedEmployees,
        total: mysqlTotal,
        timestamp: Date.now(),
      };
    }

    // Transform MySQL response to match expected format
    return NextResponse.json({
      success: response.success,
      data: transformedEmployees,
      // Use MySQL total count for full access, filtered count for restricted access
      total: !session.access.can_view_all ? actualData.length : mysqlTotal,
      // Check if there are more pages (only relevant for full access)
      hasMore: !session.access.can_view_all || (!limit && !offset) ? false : currentPage < lastPage,
    });
  } catch (error) {
    timing.total({ result: "error" });
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
