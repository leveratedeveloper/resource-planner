import { NextResponse } from "next/server";
import { getAllBusinessUnits, createBusinessUnit } from "@/lib/db/queries";

export async function GET() {
  try {
    const businessUnits = await getAllBusinessUnits();
    return NextResponse.json({ success: true, data: businessUnits });
  } catch (error) {
    console.error("Failed to fetch business units:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch business units" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.name || !body.code) {
      return NextResponse.json(
        { success: false, error: "Name and code are required" },
        { status: 400 }
      );
    }
    
    const businessUnit = await createBusinessUnit({
      name: body.name,
      code: body.code,
      color: body.color || "#3b82f6",
      description: body.description || null,
      isActive: body.isActive ?? true,
    });
    
    return NextResponse.json({ success: true, data: businessUnit }, { status: 201 });
  } catch (error) {
    console.error("Failed to create business unit:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create business unit" },
      { status: 500 }
    );
  }
}
