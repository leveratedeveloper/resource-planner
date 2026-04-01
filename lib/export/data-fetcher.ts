/**
 * Export Data Fetcher
 * Functions to fetch and join data from multiple sources for exports
 */

import { getSession } from '@/lib/auth/session';
import { assignmentsDb } from '@/lib/mysql-assignments/db';
import { NextRequest } from 'next/server';
import { getMySqlApiClient } from '@/lib/mysql/api-client';

// Get base URL for server-side fetch (for local API calls)
function getBaseUrl(request?: NextRequest): string {
  if (typeof window !== 'undefined') {
    // Client side
    return window.location.origin;
  }

  // Server side
  const host = request?.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

// ============================================================================
// Employee Data
// ============================================================================

export interface EmployeeData {
  uuid: string;
  nik: string;
  full_name: string;
  nickname: string;
  position: string;
  dept_id: number;
  department_name: string;
  photo: string;
  flag: string;
}

/**
 * Fetch all employees from MySQL API using authenticated client
 * This matches the employee_uuid format used in the assignments table
 */
export async function fetchAllEmployees(request?: NextRequest): Promise<EmployeeData[]> {
  try {
    const session = await getSession();
    if (!session) {
      console.warn('[Export Data] No session found for fetching employees');
      return [];
    }

    const apiClient = getMySqlApiClient(async () => session.access_token);
    const allEmployees: EmployeeData[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await apiClient.getEmployees({
        page,
        per_page: perPage,
      });

      if (response.error || !response.success) {
        console.warn('[Export Data] Failed to fetch employees from MySQL API:', response.error);
        break;
      }

      // For list endpoints, response is raw JSON { data: { data: [...] } }
      // For single endpoints, response has { success, data, error }
      // Check if this is an error response
      const hasError = response && typeof response === 'object' && 'error' in response;
      const hasSuccess = response && typeof response === 'object' && 'success' in response;
      const isFailed = hasSuccess && response.success === false;

      if (hasError || isFailed) {
        console.warn('[Export Data] Failed to fetch employees from MySQL API:', response?.error || 'Unknown error');
        break;
      }

      // Handle nested response structure: { data: { data: [...] } }
      let employees = response || {};

      // If response has explicit data field (paginated response), use it
      if (employees.data) {
        employees = employees.data;
      }

      // Second level unwrap: { data: [...] } -> [...]
      if (employees.data && Array.isArray(employees.data)) {
        employees = employees.data;
      }

      const employeeArray = Array.isArray(employees) ? employees : [];

      console.log('[Export Data] Employees array length:', employeeArray.length);

      // Transform to our format
      const transformed = employeeArray.map((emp: any) => ({
        uuid: emp.uuid || emp.id,
        nik: emp.employee_number || emp.nik || '',
        full_name: emp.full_name || emp.fullName || '',
        nickname: emp.nickname || '',
        position: emp.position || '',
        dept_id: parseInt(emp.dept_id?.toString() || emp.departmentId?.toString() || '0', 10),
        department_name: emp.department_name || emp.department?.name || '',
        photo: emp.photo || '',
        flag: emp.flag === 'active' || emp.employment_status === 'active' ? 'active' : 'inactive',
      }));

      allEmployees.push(...transformed);

      // Check if there are more pages (total is in the first data object)
      // Response structure: { data: { data: [...], total: 123 } }
      const total = (response && response.data && response.data.total) || 0;
      hasMore = allEmployees.length < total && employeeArray.length > 0;
      page++;

      // Safety break to prevent infinite loop
      if (allEmployees.length > 10000 || employeeArray.length === 0) break;
    }

    console.log('[Export Data] Fetched employees from MySQL API:', allEmployees.length);
    return allEmployees;
  } catch (error) {
    console.warn('[Export Data] Error fetching employees from MySQL API:', error);
    return [];
  }
}

/**
 * Fetch employee by UUID from MySQL API using authenticated client
 */
export async function fetchEmployeeByUUID(uuid: string, request?: NextRequest): Promise<EmployeeData | null> {
  try {
    const session = await getSession();
    if (!session) {
      return null;
    }

    const apiClient = getMySqlApiClient(async () => session.access_token);
    const response = await apiClient.getEmployee(uuid);

    if (response.error || !response.success || !response.data) {
      return null;
    }

    const emp = response.data;
    return {
      uuid: emp.uuid || emp.id || uuid,
      nik: emp.employee_number || emp.nik || '',
      full_name: emp.full_name || emp.fullName || '',
      nickname: emp.nickname || '',
      position: emp.position || '',
      dept_id: parseInt(emp.dept_id?.toString() || emp.departmentId?.toString() || '0', 10),
      department_name: emp.department_name || emp.department?.name || '',
      photo: emp.photo || '',
      flag: emp.flag === 'active' || emp.employment_status === 'active' ? 'active' : 'inactive',
    };
  } catch (error) {
    console.warn('[Export Data] Error fetching employee by UUID:', error);
    return null;
  }
}

// ============================================================================
// Campaign/Project Data
// ============================================================================

export interface CampaignData {
  uuid: string;
  io_number: string;
  campaign_name: string;
  brand_id: string;
  brand_name: string;
  company_name: string;
  state: 'draft' | 'publish' | 'archive';
  start_date: string;
  end_date: string;
  budget: number;
  currency: string;
}

/**
 * Fetch all campaigns from MySQL API using authenticated client
 * This matches the project_uuid format used in the assignments table
 */
export async function fetchAllCampaigns(request?: NextRequest): Promise<CampaignData[]> {
  try {
    const session = await getSession();
    if (!session) {
      console.warn('[Export Data] No session found for fetching campaigns');
      return [];
    }

    const apiClient = getMySqlApiClient(async () => session.access_token);
    const allCampaigns: CampaignData[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await apiClient.getCampaigns({
        page,
        per_page: perPage,
      });

      // For list endpoints, response is raw JSON { data: { data: [...] } }
      // For single endpoints, response has { success, data, error }
      // Check if this is an error response
      const hasError = response && typeof response === 'object' && 'error' in response;
      const hasSuccess = response && typeof response === 'object' && 'success' in response;
      const isFailed = hasSuccess && response.success === false;

      if (hasError || isFailed) {
        console.warn('[Export Data] Failed to fetch campaigns from MySQL API:', response?.error || 'Unknown error');
        break;
      }

      // Handle nested response structure: { data: { data: [...] } }
      let campaigns = response || {};

      // If response has explicit data field (paginated response), use it
      if (campaigns.data) {
        campaigns = campaigns.data;
      }

      // Second level unwrap: { data: [...] } -> [...]
      if (campaigns.data && Array.isArray(campaigns.data)) {
        campaigns = campaigns.data;
      }

      const campaignsArray = Array.isArray(campaigns) ? campaigns : [];

      console.log('[Export Data] Campaigns array length:', campaignsArray.length);

      // Transform to our format
      const transformed = campaignsArray.map((c: any) => ({
        uuid: c.uuid || c.id,
        io_number: c.io_number || c.project_number || '',
        campaign_name: c.campaign_name || c.name || '',
        brand_id: c.brand_id?.toString() || c.brandId?.toString() || '',
        brand_name: c.brand_name || c.brand?.name || '',
        company_name: c.company_name || c.brand_name || '',
        state: c.state || 'publish',
        start_date: c.start_date || c.startDate || '',
        end_date: c.end_date || c.endDate || '',
        budget: parseFloat(c.budget) || 0,
        currency: c.currency || 'IDR',
      }));

      allCampaigns.push(...transformed);

      // Check if there are more pages (total is in the first data object)
      // Response structure: { data: { data: [...], total: 123 } }
      const total = (response && response.data && response.data.total) || 0;
      hasMore = allCampaigns.length < total && campaignsArray.length > 0;
      page++;

      // Safety break to prevent infinite loop
      if (allCampaigns.length > 10000 || campaignsArray.length === 0) break;
    }

    console.log('[Export Data] Fetched campaigns from MySQL API:', allCampaigns.length);
    return allCampaigns;
  } catch (error) {
    console.warn('[Export Data] Error fetching campaigns from MySQL API:', error);
    return [];
  }
}

/**
 * Fetch campaign by UUID
 */
export async function fetchCampaignByUUID(uuid: string, request?: NextRequest): Promise<CampaignData | null> {
  const campaigns = await fetchAllCampaigns(request);
  return campaigns.find(c => c.uuid === uuid) || null;
}

// ============================================================================
// Assignment Data with Joins
// ============================================================================

export interface AssignmentWithDetails {
  uuid: string;
  employee_uuid: string;
  project_uuid: string | null;
  start_date: string;
  end_date: string;
  hours_per_day: number;
  allocation_percentage: number | null;
  is_time_off: boolean;
  category: string | null;
  is_billable: boolean;
  status: string;
  note: string | null;
  // Joined data
  employee?: EmployeeData;
  project?: CampaignData;
}

/**
 * Fetch assignments with employee and project details
 */
export async function fetchAssignmentsWithDetails(
  filters?: {
    employee_uuid?: string;
    project_uuid?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  },
  request?: NextRequest
): Promise<AssignmentWithDetails[]> {
  try {
    let query = 'SELECT * FROM assignments WHERE 1=1';
    const params: any[] = [];

    if (filters?.employee_uuid) {
      query += ' AND employee_uuid = ?';
      params.push(filters.employee_uuid);
    }
    if (filters?.project_uuid) {
      query += ' AND project_uuid = ?';
      params.push(filters.project_uuid);
    }
    if (filters?.start_date) {
      query += ' AND end_date >= ?';
      params.push(filters.start_date);
    }
    if (filters?.end_date) {
      query += ' AND start_date <= ?';
      params.push(filters.end_date);
    }
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY start_date DESC';

    const [rows] = await assignmentsDb.execute(query, params);
    const assignments = rows as any[];

    if (assignments.length === 0) {
      console.log('[Export Data] No assignments found for filters:', filters);
      return [];
    }

    console.log('[Export Data] Found assignments:', assignments.length);

    // Collect all unique employee_uuids and project_uuids
    const employeeUuids = [...new Set(assignments.map(a => a.employee_uuid))];
    const projectUuids = [...new Set(assignments.map(a => a.project_uuid).filter(Boolean))];

    console.log('[Export Data] Unique employee_uuids:', employeeUuids.length);
    console.log('[Export Data] Sample employee_uuids:', employeeUuids.slice(0, 3));

    // Fetch employees that match our assignments (not all employees)
    const employeesMap = new Map<string, EmployeeData>();

    // Get session and API client for authenticated requests
    const session = await getSession();
    const apiClient = session ? getMySqlApiClient(async () => session.access_token) : null;

    // For each employee_uuid in assignments, try to find matching employee from MySQL API
    if (apiClient) {
      for (const empUuid of employeeUuids) {
        try {
          const response = await apiClient.getEmployee(empUuid);
          if (response.success && response.data) {
            // Handle nested response structure: { data: { data: {...} } }
            let emp = response.data;
            if (emp && typeof emp === 'object' && !Array.isArray(emp) && !emp.uuid) {
              emp = emp.data || emp;
            }
            if (emp && emp.uuid) {
              employeesMap.set(empUuid, {
                uuid: emp.uuid || emp.id || empUuid,
                nik: emp.employee_number || emp.nik || '',
                full_name: emp.full_name || emp.fullName || '',
                nickname: emp.nickname || '',
                position: emp.position || '',
                dept_id: parseInt(emp.dept_id?.toString() || emp.departmentId?.toString() || '0', 10),
                department_name: emp.department_name || emp.department?.name || '',
                photo: emp.photo || '',
                flag: emp.flag === 'active' || emp.employment_status === 'active' ? 'active' : 'inactive',
              });
              console.log('[Export Data] Found employee:', empUuid, emp.full_name || emp.fullName);
            }
          }
        } catch (err) {
          console.warn('[Export Data] Could not fetch employee:', empUuid, err);
        }
      }
    }

    console.log('[Export Data] Matched employees:', employeesMap.size, 'of', employeeUuids.length);

    // Fetch campaigns that match our assignments
    const campaignsMap = new Map<string, CampaignData>();
    const campaigns = await fetchAllCampaigns(request);
    campaigns.forEach(c => campaignsMap.set(c.uuid, c));

    console.log('[Export Data] Available campaigns:', campaigns.length);
    console.log('[Export Data] Sample project_uuids from assignments:', [...new Set(assignments.map((a: any) => a.project_uuid).filter(Boolean))].slice(0, 5));
    console.log('[Export Data] Sample campaign UUIDs from API:', campaigns.slice(0, 5).map(c => ({ uuid: c.uuid, name: c.campaign_name })));

    // Log unmatched projects
    const unmatchedProjects = assignments.filter((a: any) => a.project_uuid && !campaignsMap.has(a.project_uuid));
    if (unmatchedProjects.length > 0) {
      console.warn('[Export Data] Assignments with unmatched project_uuid:', unmatchedProjects.length);
      console.warn('[Export Data] Unmatched project_uuids:', [...new Set(unmatchedProjects.map((a: any) => a.project_uuid))]);
    }

    // Join data
    const result = assignments.map((a: any) => ({
      uuid: a.uuid,
      employee_uuid: a.employee_uuid,
      project_uuid: a.project_uuid,
      start_date: a.start_date,
      end_date: a.end_date,
      hours_per_day: parseFloat(a.hours_per_day) || 0,
      allocation_percentage: a.allocation_percentage ? parseFloat(a.allocation_percentage) : null,
      is_time_off: Boolean(a.is_time_off),
      category: a.category,
      is_billable: Boolean(a.is_billable),
      status: a.status,
      note: a.note,
      employee: employeesMap.get(a.employee_uuid),
      project: a.project_uuid ? campaignsMap.get(a.project_uuid) : undefined,
    }));

    // Log assignments without employee matches
    const unmatchedEmployees = result.filter(a => !a.employee);
    if (unmatchedEmployees.length > 0) {
      console.warn('[Export Data] Assignments without employee match:', unmatchedEmployees.length);
      console.warn('[Export Data] Unmatched employee_uuids:', [...new Set(unmatchedEmployees.map(a => a.employee_uuid))]);
    }

    console.log('[Export Data] Fetched assignments with details:', result.length);
    return result;
  } catch (error) {
    console.error('[Export Data] Error fetching assignments:', error);
    return [];
  }
}

/**
 * Get current employee UUID from session
 */
export async function getCurrentEmployeeUUID(): Promise<string | null> {
  try {
    const session = await getSession();
    return session?.employee?.uuid || null;
  } catch {
    return null;
  }
}

/**
 * Check if user has full access
 */
export async function hasFullAccess(): Promise<boolean> {
  try {
    const session = await getSession();
    return session?.access?.can_view_all || false;
  } catch {
    return false;
  }
}
