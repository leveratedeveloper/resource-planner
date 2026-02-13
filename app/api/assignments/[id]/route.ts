import { NextResponse } from "next/server";
import { getAssignmentById, updateAssignment, deleteAssignment } from "@/lib/db/queries";
import { AssignmentUpdateSchema, AssignmentPutSchema, formatZodErrors } from "@/lib/validations/schemas";

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
    const rawBody = await request.json();

    // Validate with Zod
    const parsed = AssignmentPutSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    // Only pass fields that were actually provided (partial update)
    const body = parsed.data;
    const assignment = await updateAssignment(id, body);
    
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
