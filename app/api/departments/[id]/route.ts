import { NextResponse } from "next/server";
import { getDepartmentById, updateDepartment, deleteDepartment } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const department = await getDepartmentById(id);
    
    if (!department) {
      return NextResponse.json(
        { success: false, error: "Department not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: department });
  } catch (error) {
    console.error("Failed to fetch department:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch department" },
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
    
    const department = await updateDepartment(id, {
      businessUnitId: body.businessUnitId,
      name: body.name,
      code: body.code,
      color: body.color,
      description: body.description,
      isActive: body.isActive,
    });
    
    if (!department) {
      return NextResponse.json(
        { success: false, error: "Department not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: department });
  } catch (error) {
    console.error("Failed to update department:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update department" },
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
    await deleteDepartment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete department:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete department" },
      { status: 500 }
    );
  }
}
