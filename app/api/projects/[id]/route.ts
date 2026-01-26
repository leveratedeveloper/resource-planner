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
      projectCategoryId: body.projectCategoryId,
      projectTypeId: body.projectTypeId,
      projectType: body.projectType,
      entity: body.entity,
      name: body.name,
      projectNumber: body.projectNumber,
      description: body.description,
      color: body.color,
      budget: body.budget,
      asf: body.asf,
      grandTotal: body.grandTotal,
      currency: body.currency,
      ioFile: body.ioFile,
      flag: body.flag,
      quotationReference: body.quotationReference,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status,
      createdById: body.createdById,
      notes: body.notes,
      // Pitch-specific fields
      region: body.region,
      submitDate: body.submitDate,
      pitchStatus: body.pitchStatus,
      valueTotalEstimate: body.valueTotalEstimate,
      hsDealId: body.hsDealId,
      // Project channels
      projectChannels: body.projectChannels,
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
