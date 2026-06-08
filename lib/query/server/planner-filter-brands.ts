import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import type { PlannerDirectoryBrandRow } from "@/lib/planner-directory/types";
import type { Brand } from "@/lib/query/hooks/useBrands";

export type PlannerFilterBrandsRequest = {
  offset: number;
  limit: number;
  search?: string | null;
  selectedBrandId?: string | null;
};

export type PlannerFilterBrandsResponse = {
  brands: Brand[];
  total: number;
  hasMore: boolean;
  selectedBrand: Brand | null;
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

export async function fetchPlannerFilterBrands(
  request: PlannerFilterBrandsRequest
): Promise<PlannerFilterBrandsResponse> {
  const fetchedAt = new Date().toISOString();
  const brandPage = await plannerDirectoryRepository.listBrandsForFilterOptions({
    offset: request.offset,
    limit: request.limit,
    search: request.search?.trim() || undefined,
  });

  const selectedBrand = request.selectedBrandId
    ? (await plannerDirectoryRepository.listBrandsByIds([request.selectedBrandId]))[0] ?? null
    : null;

  return {
    brands: brandPage.data.map(toBrandOption),
    total: brandPage.total,
    hasMore: brandPage.hasMore,
    selectedBrand: selectedBrand ? toBrandOption(selectedBrand) : null,
    freshness: {
      fetchedAt,
    },
  };
}
