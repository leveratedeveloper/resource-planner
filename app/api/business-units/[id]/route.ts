import { NextResponse } from "next/server";
import { getBusinessUnitById, updateBusinessUnit, deleteBusinessUnit } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const businessUnit = await getBusinessUnitById(id);
    
    if (!businessUnit) {
      return NextResponse.json(
        { success: false, error: "Business unit not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: businessUnit });
  } catch (error) {
    console.error("Failed to fetch business unit:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch business unit" },
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
    
    const businessUnit = await updateBusinessUnit(id, {
      name: body.name,
      code: body.code,
      color: body.color,
      description: body.description,
      isActive: body.isActive,
    });
    
    if (!businessUnit) {
      return NextResponse.json(
        { success: false, error: "Business unit not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: businessUnit });
  } catch (error) {
    console.error("Failed to update business unit:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update business unit" },
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
    await deleteBusinessUnit(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete business unit:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete business unit" },
      { status: 500 }
    );
  }
}
