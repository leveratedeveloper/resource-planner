import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface EmployeeBrandAssignment {
  id: string;
  employeeId: string;
  brandId: string;
  isPrimary: boolean;
  startDate: string | null;
  endDate: string | null;
  employee?: {
    id: string;
    fullName: string;
    position: string;
  };
  brand?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface Brand {
  id: string;
  businessUnitId: string | null;
  name: string;
  companyName: string | null;
  brandAddress: string | null;
  clientCode: string | null;
  color: string;
  logo: string | null;
  website: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  picFinanceName: string | null;
  picFinancePhone: string | null;
  industryCategory: string | null;
  description: string | null;
  status: "active" | "inactive" | "prospect";
  createdAt: string;
  updatedAt: string;
  businessUnit?: {
    id: string;
    name: string;
    color: string;
  };
  employeeBrandAssignments?: EmployeeBrandAssignment[];
}

export type NewBrand = {
  name: string;
  color?: string;
  status?: "active" | "inactive" | "prospect";
  businessUnitId?: string | null;
  companyName?: string | null;
  brandAddress?: string | null;
  clientCode?: string | null;
  logo?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  picFinanceName?: string | null;
  picFinancePhone?: string | null;
  industryCategory?: string | null;
  description?: string | null;
};

// API Functions
async function fetchBrands(): Promise<Brand[]> {
  const response = await fetch("/api/brands");
  if (!response.ok) {
    throw new Error("Failed to fetch brands");
  }
  const data = await response.json();
  return data.data;
}

async function fetchBrand(id: string): Promise<Brand> {
  const response = await fetch(`/api/brands/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch brand");
  }
  const data = await response.json();
  return data.data;
}

// Hooks
export function useBrands() {
  return useQuery({
    queryKey: queryKeys.brands,
    queryFn: fetchBrands,
  });
}

const PAGE_SIZE = 12;

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

async function fetchBrandsPaginated({ pageParam = 0, search }: { pageParam?: number; search?: string }): Promise<PaginatedResponse<Brand>> {
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
  const url = `/api/brands?limit=${PAGE_SIZE}&offset=${pageParam}${searchParam}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch brands");
  }

  const result = await response.json();
  return {
    data: result.data || [],
    total: result.total || 0,
    hasMore: result.hasMore || false,
  };
}

export function useInfiniteBrands(search?: string) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.brandsInfinite, search],
    queryFn: ({ pageParam }) => fetchBrandsPaginated({ pageParam, search }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((acc, page) => acc + page.data.length, 0);
    },
  });
}

export function useBrand(id: string) {
  return useQuery({
    queryKey: queryKeys.brand(id),
    queryFn: () => fetchBrand(id),
    enabled: !!id,
  });
}
