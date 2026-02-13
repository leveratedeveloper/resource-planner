import { NextResponse } from "next/server";
import { getAllBrands, getBrandsPaginated } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const search = searchParams.get("search");
    
    // If pagination params are provided, use paginated query
    if (limit !== null && offset !== null) {
      const parsedLimit = parseInt(limit, 10);
      const parsedOffset = parseInt(offset, 10);

      if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
        return NextResponse.json(
          { success: false, error: "Limit and offset must be valid numbers" },
          { status: 400 }
        );
      }

      const result = await getBrandsPaginated(
        parsedLimit,
        parsedOffset,
        search || undefined
      );
      return NextResponse.json({ 
        success: true, 
        data: result.data,
        total: result.total,
        hasMore: result.hasMore,
      });
    }
    
    // Otherwise use the regular query (for backward compatibility)
    const brands = await getAllBrands();
    return NextResponse.json({ success: true, data: brands });
  } catch (error) {
    console.error("Failed to fetch brands:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}
