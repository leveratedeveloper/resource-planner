/**
 * Export Data Fetcher
 * Functions to fetch and join data from multiple sources for exports
 */

import { getSession } from '@/lib/auth/session';
import { assignmentsDb } from '@/lib/mysql-assignments/db';
import { NextRequest } from 'next/server';
import { getMySqlApiClient } from '@/lib/mysql/api-client';

// ============================================================================
// In-Memory Cache (with TTL)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const brandCache: CacheEntry<Map<number, string>> | null = null;
const BRAND_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const EMPLOYEE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getFromCache<T>(cache: CacheEntry<T> | null, ttl: number): T | null {
  if (!cache) return null;
  const now = Date.now();
  if (now - cache.timestamp > ttl) {
    return null; // Cache expired
  }
  return cache.data;
}

function setCache<T>(data: T): CacheEntry<T> {
  return { data, timestamp: Date.now() };
}

// Global cache variables (will persist across requests in the same server instance)
let globalBrandCache: CacheEntry<Map<number, string>> | null = null;
let globalDepartmentCache: CacheEntry<Map<string, string>> | null = null;
let globalCampaignCache: CacheEntry<CampaignData[]> | null = null;
let globalEmployeeCache: CacheEntry<Map<string, EmployeeData>> | null = null;

/**
 * Clear all caches (useful for testing or after data updates)
 */
export function clearExportDataCache(): void {
  globalBrandCache = null;
  globalDepartmentCache = null;
  globalCampaignCache = null;
  globalEmployeeCache = null;
  console.log('[Export Data] All caches cleared');
}

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
        include: 'department',
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
// Department Data
// ============================================================================

export interface DepartmentData {
  id: number;
  department_name: string;
  flag: string;
}

/**
 * Fetch all departments from MySQL API (with caching)
 */
export async function fetchAllDepartments(request?: NextRequest): Promise<DepartmentData[]> {
  // Check cache first
  const cached = getFromCache(globalDepartmentCache, BRAND_CACHE_TTL);
  if (cached) {
    console.log('[Export Data] Using cached departments:', cached.size);
    return Array.from(cached.entries()).map(([id, name]) => ({
      id: parseInt(id, 10),
      department_name: name,
      flag: 'active'
    }));
  }

  try {
    const session = await getSession();
    if (!session) {
      console.warn('[Export Data] No session found for fetching departments');
      return [];
    }

    console.log('[Export Data] Cache miss, fetching departments from MySQL API...');
    const apiClient = getMySqlApiClient(async () => session.access_token);
    const allDepartments: DepartmentData[] = [];
    let page = 1;
    const perPage = 500; // Increased from 100 to reduce API calls
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${apiClient['baseUrl'] || 'http://127.0.0.1:8000/api/v1'}/departments?page=${page}&per_page=${perPage}`, {
        headers: {
          'Authorization': `Bearer ${await (await apiClient.getToken())}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('[Export Data] Failed to fetch departments from MySQL API');
        break;
      }

      const data = await response.json();
      let departments = data.data?.data || data.data || [];

      const deptArray = Array.isArray(departments) ? departments : [];
      console.log('[Export Data] Departments array length:', deptArray.length);

      const transformed = deptArray.map((d: any) => ({
        id: d.id,
        department_name: d.department_name,
        flag: d.flag,
      }));

      allDepartments.push(...transformed);

      const total = data.data?.meta?.total || data.meta?.total || 0;
      hasMore = allDepartments.length < total && deptArray.length > 0;
      page++;

      if (allDepartments.length > 10000 || deptArray.length === 0) break;
    }

    console.log('[Export Data] Fetched departments from MySQL API:', allDepartments.length);

    // Cache as Map for faster lookup
    const deptMap = new Map(allDepartments.map(d => [d.id.toString(), d.department_name]));
    globalDepartmentCache = setCache(deptMap);

    return allDepartments;
  } catch (error) {
    console.warn('[Export Data] Error fetching departments from MySQL API:', error);
    return [];
  }
}

// ============================================================================
// Brand Data
// ============================================================================

export interface BrandData {
  id: number;
  uuid: string;
  brand_name: string;
  flag: string;
}

/**
 * Fetch ALL brands from MySQL API (with caching)
 */
export async function fetchAllBrands(request?: NextRequest): Promise<Map<number, string>> {
  // Check cache first
  const cached = getFromCache(globalBrandCache, BRAND_CACHE_TTL);
  if (cached) {
    console.log('[Export Data] Using cached brands:', cached.size);
    return new Map(cached); // Return a copy to avoid mutations
  }

  try {
    const session = await getSession();
    if (!session) {
      console.warn('[Export Data] No session found for fetching brands');
      return new Map();
    }

    const brandFetchStart = Date.now();
    console.log('[Export Data] Cache miss, fetching brands from MySQL API...');
    const apiClient = getMySqlApiClient(async () => session.access_token);
    const brandMap = new Map<number, string>();
    let page = 1;
    const perPage = 500; // Increased from 100 to reduce API calls
    let hasMore = true;

    // Fetch all pages of brands
    while (hasMore) {
      const response = await apiClient.getBrands({ page, per_page: perPage });

      if (response.error) {
        console.warn('[Export Data] Error fetching brands page:', page, response.error);
        break;
      }

      // Handle nested response structure
      let brands = response || {};
      if (brands.data) {
        brands = brands.data;
      }
      if (brands.data && Array.isArray(brands.data)) {
        brands = brands.data;
      }

      const brandsArray = Array.isArray(brands) ? brands : [];

      // Add to brand map
      brandsArray.forEach((b: any) => {
        const id = parseInt(b.brand_id?.toString() || b.id?.toString() || '0', 10);
        if (id > 0 && b.brand_name) {
          brandMap.set(id, b.brand_name);
        }
      });

      console.log('[Export Data] Fetched brands page:', page, 'total so far:', brandMap.size);

      // Check if there are more pages
      const meta = response?.data?.meta || response?.meta;
      hasMore = meta && meta.current_page < meta.last_page;
      page++;

      // Safety break
      if (brandMap.size > 10000 || brandsArray.length === 0) break;
    }

    console.log('[Export Data] Total brands fetched from MySQL API:', brandMap.size, 'in', Date.now() - brandFetchStart, 'ms');

    // Cache the result
    globalBrandCache = setCache(brandMap);

    return brandMap;
  } catch (error) {
    console.warn('[Export Data] Error fetching brands from MySQL API:', error);
    return new Map();
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
 * Note: brandMap is passed in but campaigns are cached without brand enrichment
 */
export async function fetchAllCampaigns(request?: NextRequest, brandMap?: Map<number, string>): Promise<CampaignData[]> {
  // Note: We don't cache campaigns with brand enrichment since brandMap may change
  // But we can cache raw campaigns data and enrich on each call
  const CAMPAIGN_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

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

      // Debug: log brandMap size and sample entries
      if (page === 1 && brandMap) {
        console.log('[Export Data] BrandMap size:', brandMap.size);
        console.log('[Export Data] BrandMap sample entries:', Array.from(brandMap.entries()).slice(0, 5));
      }

      // Transform to our format
      const transformed = campaignsArray.map((c: any) => {
        const brandId = parseInt(c.brand_id?.toString() || c.brandId?.toString() || '0', 10);
        const brandName = c.brand_name || c.brand?.name || (brandMap && brandMap.get(brandId)) || '';

        // Debug: log when brand name is not found
        if (brandId > 0 && !brandName) {
          console.log('[Export Data] Brand not found for campaign:', {
            campaign: c.campaign_name || c.name,
            brand_id: brandId,
            brand_name_from_api: c.brand_name,
            brand_name_from_map: brandMap?.get(brandId),
          });
        }

        return {
          uuid: c.uuid || c.id,
          io_number: c.io_number || c.project_number || '',
          campaign_name: c.campaign_name || c.name || '',
          brand_id: brandId.toString(),
          brand_name: brandName,
          company_name: c.company_name || c.brand_name || '',
          state: c.state || 'publish',
          start_date: c.start_date || c.startDate || '',
          end_date: c.end_date || c.endDate || '',
          budget: parseFloat(c.budget) || 0,
          currency: c.currency || 'IDR',
        };
      });

      allCampaigns.push(...transformed);

      // Check if there are more pages (total is in the first data object)
      // Response structure: { data: { data: [...], meta: { total: 123 } } }
      const total = (response && response.data && response.data.meta && response.data.meta.total) ||
                    (response && response.meta && response.meta.total) ||
                    (response && response.data && response.data.total) || 0;
      hasMore = allCampaigns.length < total && campaignsArray.length > 0;

      if (page === 1) {
        console.log('[Export Data] Campaigns pagination:', { total, fetched: allCampaigns.length, hasMore });
      }

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

/**
 * Fetch campaigns by specific UUIDs (optimized - only fetches what's needed)
 * This is much faster than fetchAllCampaigns when we only need a few campaigns
 */
export async function fetchCampaignsByUUIDs(
  uuids: string[],
  request?: NextRequest,
  brandMap?: Map<number, string>
): Promise<CampaignData[]> {
  if (!uuids || uuids.length === 0) {
    return [];
  }

  try {
    const session = await getSession();
    if (!session) {
      console.warn('[Export Data] No session found for fetching campaigns by UUIDs');
      return [];
    }

    console.log('[Export Data] Fetching specific campaigns by UUIDs:', uuids.length, 'campaigns');
    const apiClient = getMySqlApiClient(async () => session.access_token);

    // If no brandMap provided, fetch it
    const effectiveBrandMap = brandMap || await fetchAllBrands(request);

    // Fetch campaigns page by page until we find all the UUIDs we need
    const foundCampaigns = new Map<string, CampaignData>();
    const remainingUuids = new Set(uuids);
    let page = 1;
    const perPage = 500; // Increased from 100 to reduce API calls
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 20; // Safety limit

    while (hasMore && remainingUuids.size > 0 && pageCount < maxPages) {
      const response = await apiClient.getCampaigns({
        page,
        per_page: perPage,
      });

      // Check for errors
      const hasError = response && typeof response === 'object' && 'error' in response;
      const hasSuccess = response && typeof response === 'object' && 'success' in response;
      const isFailed = hasSuccess && response.success === false;

      if (hasError || isFailed) {
        console.warn('[Export Data] Failed to fetch campaigns page:', page);
        break;
      }

      // Handle nested response structure
      let campaigns = response || {};
      if (campaigns.data) {
        campaigns = campaigns.data;
      }
      if (campaigns.data && Array.isArray(campaigns.data)) {
        campaigns = campaigns.data;
      }

      const campaignsArray = Array.isArray(campaigns) ? campaigns : [];

      // Find campaigns that match our UUIDs
      for (const c of campaignsArray) {
        const uuid = c.uuid || c.id;
        if (remainingUuids.has(uuid)) {
          const brandId = parseInt(c.brand_id?.toString() || c.brandId?.toString() || '0', 10);
          const brandName = c.brand_name || c.brand?.name || (effectiveBrandMap && effectiveBrandMap.get(brandId)) || '';

          foundCampaigns.set(uuid, {
            uuid: uuid,
            io_number: c.io_number || c.project_number || '',
            campaign_name: c.campaign_name || c.name || '',
            brand_id: brandId.toString(),
            brand_name: brandName,
            company_name: c.company_name || c.brand_name || '',
            state: c.state || 'publish',
            start_date: c.start_date || c.startDate || '',
            end_date: c.end_date || c.endDate || '',
            budget: parseFloat(c.budget) || 0,
            currency: c.currency || 'IDR',
          });

          remainingUuids.delete(uuid);
        }
      }

      pageCount++;
      console.log('[Export Data] Fetched campaigns page:', page, 'found:', foundCampaigns.size, 'remaining:', remainingUuids.size);

      // Check if there are more pages
      const total = (response && response.data && response.data.meta && response.data.meta.total) ||
                    (response && response.meta && response.meta.total) ||
                    (response && response.data && response.data.total) || 0;
      hasMore = campaignsArray.length > 0 && (page * perPage) < total;

      page++;
    }

    console.log('[Export Data] Total campaigns fetched by UUID:', foundCampaigns.size, 'of', uuids.length, 'requested');

    // Log any UUIDs that weren't found
    if (remainingUuids.size > 0) {
      console.warn('[Export Data] Campaign UUIDs not found:', Array.from(remainingUuids));
    }

    return Array.from(foundCampaigns.values());
  } catch (error) {
    console.warn('[Export Data] Error fetching campaigns by UUIDs:', error);
    return [];
  }
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
    skipCampaigns?: boolean; // NEW: Skip fetching campaigns for faster export
  },
  request?: NextRequest
): Promise<AssignmentWithDetails[]> {
  const startTime = Date.now();
  const skipCampaigns = filters?.skipCampaigns || false;
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

    console.log('[Export Data] DB query time:', Date.now() - startTime, 'ms, assignments:', assignments.length);

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

    // Get session and API client for authenticated requests
    const session = await getSession();
    const apiClient = session ? getMySqlApiClient(async () => session.access_token) : null;

    // OPTIMIZATION: Fetch all data in PARALLEL instead of sequential
    // This is the biggest performance improvement!
    console.log('[Export Data] Fetching all data in PARALLEL...');
    const parallelStartTime = Date.now();
    const fetchStartTime = Date.now();

    const [
      employeesResult,
      departmentsResult,
      brandsResult
    ] = await Promise.allSettled([
      // Fetch employees (in batches internally)
      (async () => {
        const employeesMap = new Map<string, EmployeeData>();
        if (!apiClient) return employeesMap;

        console.log('[Export Data] Fetching employees in batches...');
        const BATCH_SIZE = 10; // Increased for better parallelization

        for (let i = 0; i < employeeUuids.length; i += BATCH_SIZE) {
          const batch = employeeUuids.slice(i, i + BATCH_SIZE);
          console.log('[Export Data] Fetching employee batch:', Math.floor(i / BATCH_SIZE) + 1, 'of', Math.ceil(employeeUuids.length / BATCH_SIZE));

          const employeePromises = batch.map(async (empUuid) => {
            try {
              const response = await apiClient!.getEmployee(empUuid);
              if (response.success && response.data) {
                let emp = response.data;
                if (emp && typeof emp === 'object' && !Array.isArray(emp) && !emp.uuid) {
                  emp = emp.data || emp;
                }
                if (emp && emp.uuid) {
                  const deptId = emp.dept_id || emp.departmentId;
                  return {
                    uuid: empUuid,
                    data: {
                      uuid: emp.uuid || emp.id || empUuid,
                      nik: emp.employee_number || emp.nik || '',
                      full_name: emp.full_name || emp.fullName || '',
                      nickname: emp.nickname || '',
                      position: emp.position || '',
                      dept_id: parseInt(deptId?.toString() || '0', 10),
                      department_name: emp.department_name || emp.department?.name || '',
                      photo: emp.photo || '',
                      flag: emp.flag === 'active' || emp.employment_status === 'active' ? 'active' : 'inactive',
                    } as EmployeeData,
                  };
                }
              }
              return null;
            } catch (err) {
              console.warn('[Export Data] Could not fetch employee:', empUuid);
              return null;
            }
          });

          const results = await Promise.all(employeePromises);

          for (const result of results) {
            if (result) {
              employeesMap.set(result.uuid, result.data);
              console.log('[Export Data] Found employee:', result.uuid, result.data.full_name);
            }
          }
        }

        console.log('[Export Data] Matched employees:', employeesMap.size, 'of', employeeUuids.length);
        return employeesMap;
      })(),

      // Fetch all departments (cached)
      (async () => {
        try {
          const departments = await fetchAllDepartments(request);
          console.log('[Export Data] Departments fetched, sample:', departments.slice(0, 3).map(d => ({ id: d.id, name: d.department_name })));
          const deptMap = new Map(departments.map(d => [d.id.toString(), d.department_name]));
          console.log('[Export Data] Department map created, sample keys:', Array.from(deptMap.keys()).slice(0, 10));
          return deptMap;
        } catch (err) {
          console.warn('[Export Data] Error fetching departments:', err);
          return new Map();
        }
      })(),

      // Fetch all brands (cached)
      (async () => {
        try {
          const brands = await fetchAllBrands(request);
          return brands;
        } catch (err) {
          console.warn('[Export Data] Error fetching brands:', err);
          return new Map();
        }
      })(),
    ]);

    // Extract results
    const employeesMap = employeesResult.status === 'fulfilled' ? employeesResult.value : new Map<string, EmployeeData>();
    const deptMap = departmentsResult.status === 'fulfilled' ? departmentsResult.value : new Map<string, string>();
    const brandMap = brandsResult.status === 'fulfilled' ? brandsResult.value : new Map<number, string>();

    console.log('[Export Data] Parallel fetch completed in', Date.now() - parallelStartTime, 'ms. Employees:', employeesMap.size, 'Departments:', deptMap.size, 'Brands:', brandMap.size);

    // DEBUG: Log deptMap keys and employee dept_ids
    console.log('[Export Data] Department map keys:', Array.from(deptMap.keys()).slice(0, 10));
    console.log('[Export Data] Employee dept_ids:', Array.from(employeesMap.values()).map(e => e.dept_id));

    // Enrich employee data with department names
    for (const [empUuid, empData] of employeesMap) {
      if (empData.dept_id > 0) {
        const deptIdKey = empData.dept_id.toString();
        const deptName = deptMap.get(deptIdKey);
        console.log('[Export Data] Enriching department for', empData.full_name, 'dept_id:', empData.dept_id, 'lookup key:', deptIdKey, 'found:', !!deptName);
        if (deptName) {
          empData.department_name = deptName;
        } else {
          console.warn('[Export Data] Department not found for dept_id:', empData.dept_id, 'Available keys:', Array.from(deptMap.keys()).slice(0, 5));
        }
      }
    }

    // Fetch campaigns that match our assignments (can now run in parallel with above)
    // Skip if not needed (e.g., for conflicts export)
    const campaignsMap = new Map<string, CampaignData>();
    if (!skipCampaigns && projectUuids.length > 0) {
      console.log('[Export Data] Fetching campaigns...');
      const campaigns = await fetchCampaignsByUUIDs(projectUuids, request, brandMap);
      campaigns.forEach(c => campaignsMap.set(c.uuid, c));

      console.log('[Export Data] Available campaigns:', campaigns.length);
      console.log('[Export Data] Sample project_uuids from assignments:', projectUuids.slice(0, 5));
      console.log('[Export Data] Sample campaign UUIDs from API:', campaigns.slice(0, 5).map(c => ({ uuid: c.uuid, name: c.campaign_name })));
    } else {
      console.log('[Export Data] Skipping campaigns fetch (skipCampaigns=true or no projects)');
    }

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

    console.log('[Export Data] Fetched assignments with details:', result.length, 'TOTAL TIME:', Date.now() - startTime, 'ms');
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
