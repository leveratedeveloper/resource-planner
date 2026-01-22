import { NextResponse } from "next/server";
import { getAllBrands, createBrand } from "@/lib/db/queries";

export async function GET() {
  try {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }
    
    const brand = await createBrand({
      businessUnitId: body.businessUnitId || null,
      name: body.name,
      clientCode: body.clientCode || null,
      color: body.color || "#3b82f6",
      logo: body.logo || null,
      website: body.website || null,
      contactName: body.contactName || null,
      contactTitle: body.contactTitle || null,
      contactEmail: body.contactEmail || null,
      contactPhone: body.contactPhone || null,
      industryCategory: body.industryCategory || null,
      description: body.description || null,
      status: body.status || "active",
    });
    
    return NextResponse.json({ success: true, data: brand }, { status: 201 });
  } catch (error) {
    console.error("Failed to create brand:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create brand" },
      { status: 500 }
    );
  }
}
