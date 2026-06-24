import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import { randomColor } from "@/lib/utils/color";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get("limit") || "1000", 10);
    const offset = Number.parseInt(searchParams.get("offset") || "0", 10);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    const brands = await plannerDirectoryRepository.listBrands();
    const filtered = brands.filter((brand) => {
      if (!search) return true;
      return brand.name.toLowerCase().includes(search) || (brand.companyName ?? "").toLowerCase().includes(search);
    });
    const data = filtered.slice(offset, offset + limit).map((brand) => ({
      id: brand.brandId,
      name: brand.name,
      businessUnitId: null,
      companyName: brand.companyName,
      brandAddress: null,
      clientCode: "",
      color: brand.color || randomColor(brand.brandId),
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
    }));

    return NextResponse.json({
      success: true,
      data,
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
    });
  } catch (error) {
    console.error("Failed to fetch brands:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch brands",
        data: [],
      },
      { status: 500 }
    );
  }
}
