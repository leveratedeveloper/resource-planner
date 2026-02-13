import { NextResponse } from "next/server";
import { getAllProjects, getProjectsByBrand, getProjectsPaginated } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");
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

      const result = await getProjectsPaginated(
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
    const projects = brandId 
      ? await getProjectsByBrand(brandId)
      : await getAllProjects();
      
    return NextResponse.json({ success: true, data: projects });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { success: false, error: "Failed to fetch projects", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
