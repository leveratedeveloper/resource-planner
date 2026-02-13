import { NextResponse } from "next/server";
import { 
  getAllAssignments, 
  getAssignmentsByEmployee, 
  getAssignmentsByProject,
  createAssignment 
} from "@/lib/db/queries";
import { AssignmentCreateSchema, formatZodErrors } from "@/lib/validations/schemas";

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
    const rawBody = await request.json();
    
    // Validate with Zod
    const parsed = AssignmentCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }
    
    const body = parsed.data;
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
