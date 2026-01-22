import { NextResponse } from "next/server";
import { getBrandById, updateBrand, deleteBrand } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const brand = await getBrandById(id);
    
    if (!brand) {
      return NextResponse.json(
        { success: false, error: "Brand not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: brand });
  } catch (error) {
    console.error("Failed to fetch brand:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch brand" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const brand = await updateBrand(id, {
      businessUnitId: body.businessUnitId,
      name: body.name,
      clientCode: body.clientCode,
      color: body.color,
      logo: body.logo,
      website: body.website,
      contactName: body.contactName,
      contactTitle: body.contactTitle,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      industryCategory: body.industryCategory,
      description: body.description,
      status: body.status,
    });
    
    if (!brand) {
      return NextResponse.json(
        { success: false, error: "Brand not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: brand });
  } catch (error) {
    console.error("Failed to update brand:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update brand" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteBrand(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete brand:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete brand" },
      { status: 500 }
    );
  }
}
