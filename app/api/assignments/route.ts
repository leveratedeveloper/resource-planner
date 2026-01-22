import { NextResponse } from "next/server";
import { 
  getAllAssignments, 
  getAssignmentsByEmployee, 
  getAssignmentsByProject,
  createAssignment 
} from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const projectId = searchParams.get("projectId");
    
    let assignments;
    if (employeeId) {
      assignments = await getAssignmentsByEmployee(employeeId);
    } else if (projectId) {
      assignments = await getAssignmentsByProject(projectId);
    } else {
      assignments = await getAllAssignments();
    }
      
    return NextResponse.json({ success: true, data: assignments });
  } catch (error) {
    console.error("Failed to fetch assignments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.employeeId || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { success: false, error: "Employee ID, start date, and end date are required" },
        { status: 400 }
      );
    }
    
    const assignment = await createAssignment({
      employeeId: body.employeeId,
      projectId: body.projectId || null,
      taskId: body.taskId || null,
      startDate: body.startDate,
      endDate: body.endDate,
      hoursPerDay: body.hoursPerDay || "8",
      allocationPercentage: body.allocationPercentage || null,
      isTimeOff: body.isTimeOff ?? false,
      timeOffTypeId: body.timeOffTypeId || null,
      category: body.category || null,
      isBillable: body.isBillable ?? true,
      status: body.status || "confirmed",
      note: body.note || null,
      createdById: body.createdById || null,
    });
    
    return NextResponse.json({ success: true, data: assignment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create assignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create assignment" },
      { status: 500 }
    );
  }
}
