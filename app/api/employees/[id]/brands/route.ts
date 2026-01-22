import { NextResponse } from "next/server";
import { 
  getEmployeeBrandAssignments, 
  createEmployeeBrandAssignment,
  deleteEmployeeBrandAssignmentByEmployeeAndBrand 
} from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;
    const assignments = await getEmployeeBrandAssignments(employeeId);
    return NextResponse.json({ success: true, data: assignments });
  } catch (error) {
    console.error("Failed to fetch employee brand assignments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employee brand assignments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;
    const body = await request.json();
    
    if (!body.brandId) {
      return NextResponse.json(
        { success: false, error: "Brand ID is required" },
        { status: 400 }
      );
    }
    
    const assignment = await createEmployeeBrandAssignment({
      employeeId,
      brandId: body.brandId,
      isPrimary: body.isPrimary ?? false,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
    });
    
    return NextResponse.json({ success: true, data: assignment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create employee brand assignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create employee brand assignment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");
    
    if (!brandId) {
      return NextResponse.json(
        { success: false, error: "Brand ID is required" },
        { status: 400 }
      );
    }
    
    await deleteEmployeeBrandAssignmentByEmployeeAndBrand(employeeId, brandId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete employee brand assignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete employee brand assignment" },
      { status: 500 }
    );
  }
}
