import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import type { PlannerDirectoryBrandRow } from "@/lib/planner-directory/types";
import type { Brand } from "@/lib/query/hooks/useBrands";

export type PlannerFilterBrandsRequest = Record<string, never>;

export type PlannerFilterBrandsResponse = {
  brands: Brand[];
  total: number;
  hasMore: boolean;
  freshness: {
    fetchedAt: string;
  };
};

function randomColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) & 0xffffff;
  }

  return `#${hash.toString(16).padStart(6, "0")}`;
}

function toBrandOption(brand: PlannerDirectoryBrandRow): Brand {
  return {
    id: brand.brandId,
    businessUnitId: null,
    name: brand.name,
    companyName: brand.companyName,
    brandAddress: null,
    clientCode: null,
    color: brand.color ?? randomColor(brand.brandId),
    logo: null,
    website: null,
    contactName: null,
    contactTitle: null,
    contactEmail: null,
    contactPhone: null,
    picFinanceName: null,
    picFinancePhone: null,
    industryCategory: null,
    description: null,
    status:
      brand.status === "active"
        ? "active"
        : brand.status === "inactive"
          ? "inactive"
          : "prospect",
    createdAt: brand.sourceUpdatedAt ?? brand.syncedAt,
    updatedAt: brand.sourceUpdatedAt ?? brand.syncedAt,
  };
}

export async function fetchPlannerFilterBrands(): Promise<PlannerFilterBrandsResponse> {
  const fetchedAt = new Date().toISOString();
  const brands = await plannerDirectoryRepository.listBrandsForFilterOptions();

  return {
    brands: brands.map(toBrandOption),
    total: brands.length,
    hasMore: false,
    freshness: {
      fetchedAt,
    },
  };
}
