import { NextResponse } from "next/server";
import { getProjectById, updateProject, deleteProject } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProjectById(id);
    
    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch project" },
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
    
    const project = await updateProject(id, {
      brandId: body.brandId,
      businessUnitId: body.businessUnitId,
      projectTypeId: body.projectTypeId,
      name: body.name,
      projectNumber: body.projectNumber,
      description: body.description,
      color: body.color,
      budget: body.budget,
      currency: body.currency,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status,
      createdById: body.createdById,
      notes: body.notes,
    });
    
    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update project" },
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
    await deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
