import { NextResponse } from "next/server";
import { getAllDepartments, createDepartment } from "@/lib/db/queries";

export async function GET() {
  try {
    const departments = await getAllDepartments();
    return NextResponse.json({ success: true, data: departments });
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch departments" },
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
    
    const department = await createDepartment({
      businessUnitId: body.businessUnitId || null,
      name: body.name,
      code: body.code,
      color: body.color || "#10b981",
      description: body.description || null,
      isActive: body.isActive ?? true,
    });
    
    return NextResponse.json({ success: true, data: department }, { status: 201 });
  } catch (error) {
    console.error("Failed to create department:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create department" },
      { status: 500 }
    );
  }
}
