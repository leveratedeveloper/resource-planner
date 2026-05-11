/**
 * React Query Hooks for MySQL REST API
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

// ============ TYPES ============

export interface MysqlBrand {
  uuid: string;
  brand_name: string;
  company_name: string;
  pic_email: string;
  pic_brand_name: string;
  pic_brand_phone: string;
  pic_finance_name: string;
  pic_finance_phone: string;
  industry_category: string;
  brand_address: string;
  brand_website: string;
  logo: string;
  flag: 'active' | 'inactive';
  client_code: string;
}

export interface MysqlCampaign {
  uuid: string;
  io_number: string;
  campaign_name: string;
  brand_id: number;
  budget: number;
  start_date: string;
  end_date: string;
  state: 'draft' | 'publish' | 'archive';
  flag: 'active' | 'inactive';
  currency: string;
  asf?: number;
  grand_total?: number;
  brand?: {
    uuid: string;
    brand_name: string;
    company_name: string;
  };
  company?: {
    id: number;
    company_name: string;
  };
}

export interface MysqlEmployee {
  uuid: string;
  nik: string;
  full_name: string;
  nickname: string;
  position: string;
  gender: 'MALE' | 'FEMALE';
  email?: string;
  photo?: string;
  work_start_date?: string;
  flag: 'active' | 'inactive';
  status: 'visible' | 'invisible';
  department?: {
    id: number;
    department_name: string;
  };
  supervisor?: {
    uuid: string;
    full_name: string;
    position: string;
  };
  balance?: {
    annual_leave: number;
    sick_leave: number;
    total_balance: number;
  };
}

export interface MysqlResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

// ============ QUERY KEYS ============

export const mysqlQueryKeys = {
  brands: ['mysql', 'brands'] as const,
  brandsInfinite: ['mysql', 'brands', 'infinite'] as const,
  campaigns: ['mysql', 'campaigns'] as const,
  campaignsInfinite: ['mysql', 'campaigns', 'infinite'] as const,
  employees: ['mysql', 'employees'] as const,
  employeesInfinite: ['mysql', 'employees', 'infinite'] as const,
} as const;

// ============ API FUNCTIONS ============

async function fetchMysqlBrands(
  page = 1,
  perPage = 50,
  search?: string
): Promise<MysqlResponse<MysqlBrand>> {
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
  const response = await fetch(
    `/api/mysql-bridge/brands?page=${page}&per_page=${perPage}${searchParam}`
  );
  if (!response.ok) throw new Error('Failed to fetch MySQL brands');
  return response.json();
}

async function fetchMysqlCampaigns(
  page = 1,
  perPage = 50,
  search?: string
): Promise<MysqlResponse<MysqlCampaign>> {
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
  const response = await fetch(
    `/api/mysql-bridge/campaigns?page=${page}&per_page=${perPage}${searchParam}`
  );
  if (!response.ok) throw new Error('Failed to fetch MySQL campaigns');
  return response.json();
}

async function fetchMysqlEmployees(
  page = 1,
  perPage = 50,
  search?: string
): Promise<MysqlResponse<MysqlEmployee>> {
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
  const response = await fetch(
    `/api/mysql-bridge/employees?page=${page}&per_page=${perPage}${searchParam}`
  );
  if (!response.ok) throw new Error('Failed to fetch MySQL employees');
  return response.json();
}

// ============ BRANDS HOOKS ============

export function useMysqlBrands(enabled = true, search?: string) {
  return useQuery({
    queryKey: [...mysqlQueryKeys.brands, search],
    queryFn: () => fetchMysqlBrands(1, 100, search),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useMysqlBrandsInfinite(search?: string) {
  return useInfiniteQuery({
    queryKey: [...mysqlQueryKeys.brandsInfinite, search],
    queryFn: ({ pageParam = 1 }) => fetchMysqlBrands(pageParam, 50, search),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.current_page >= lastPage.meta.last_page) return undefined;
      return lastPage.meta.current_page + 1;
    },
  });
}

// ============ CAMPAIGNS HOOKS ============

export function useMysqlCampaigns(enabled = true, search?: string) {
  return useQuery({
    queryKey: [...mysqlQueryKeys.campaigns, search],
    queryFn: () => fetchMysqlCampaigns(1, 100, search),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useMysqlCampaignsInfinite(search?: string) {
  return useInfiniteQuery({
    queryKey: [...mysqlQueryKeys.campaignsInfinite, search],
    queryFn: ({ pageParam = 1 }) => fetchMysqlCampaigns(pageParam, 50, search),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.current_page >= lastPage.meta.last_page) return undefined;
      return lastPage.meta.current_page + 1;
    },
  });
}

// ============ EMPLOYEES HOOKS ============

export function useMysqlEmployees(enabled = true, search?: string) {
  return useQuery({
    queryKey: [...mysqlQueryKeys.employees, search],
    queryFn: () => fetchMysqlEmployees(1, 100, search),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useMysqlEmployeesInfinite(search?: string) {
  return useInfiniteQuery({
    queryKey: [...mysqlQueryKeys.employeesInfinite, search],
    queryFn: ({ pageParam = 1 }) => fetchMysqlEmployees(pageParam, 50, search),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.current_page >= lastPage.meta.last_page) return undefined;
      return lastPage.meta.current_page + 1;
    },
  });
}
