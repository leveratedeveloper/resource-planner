import { NextResponse } from "next/server";
import { getAssignmentById, updateAssignment, deleteAssignment } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const assignment = await getAssignmentById(id);
    
    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    console.error("Failed to fetch assignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assignment" },
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

    // Basic validation
    if (!body.employeeId || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { success: false, error: "Employee ID, start date, and end date are required" },
        { status: 400 }
      );
    }

    const assignment = await updateAssignment(id, {
      employeeId: body.employeeId,
      projectId: body.projectId,
      taskId: body.taskId,
      startDate: body.startDate,
      endDate: body.endDate,
      hoursPerDay: body.hoursPerDay,
      allocationPercentage: body.allocationPercentage,
      isTimeOff: body.isTimeOff,
      timeOffTypeId: body.timeOffTypeId,
      category: body.category,
      isBillable: body.isBillable,
      status: body.status,
      note: body.note,
      createdById: body.createdById,
    });
    
    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    console.error("Failed to update assignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update assignment" },
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
    await deleteAssignment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete assignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
}
