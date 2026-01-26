import { NextResponse } from "next/server";
import { getAllProjects, getProjectsByBrand, createProject } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");
    
    const projects = brandId 
      ? await getProjectsByBrand(brandId)
      : await getAllProjects();
      
    return NextResponse.json({ success: true, data: projects });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.name || !body.brandId) {
      return NextResponse.json(
        { success: false, error: "Name and brand ID are required" },
        { status: 400 }
      );
    }

    const projectType = body.projectType || 'campaign';

    // Conditional validation based on project type
    if (projectType === 'pitch') {
      if (!body.region || !body.submitDate || !body.pitchStatus) {
        return NextResponse.json(
          { success: false, error: "Pitch requires region, submit date, and pitch status" },
          { status: 400 }
        );
      }
    }

    const project = await createProject({
      brandId: body.brandId,
      businessUnitId: body.businessUnitId || null,
      projectCategoryId: body.projectCategoryId || null,
      projectTypeId: body.projectTypeId || null,
      projectType,
      entity: body.entity || null,
      name: body.name,
      projectNumber: body.projectNumber || null,
      description: body.description || null,
      color: body.color || "#10b981",
      budget: body.budget || null,
      asf: body.asf || null,
      grandTotal: body.grandTotal || null,
      currency: body.currency || "USD",
      ioFile: body.ioFile || null,
      flag: body.flag || null,
      quotationReference: body.quotationReference || null,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      status: body.status || "active",
      createdById: body.createdById || null,
      notes: body.notes || null,
      // Pitch-specific fields
      region: body.region || null,
      submitDate: body.submitDate || null,
      pitchStatus: body.pitchStatus || null,
      valueTotalEstimate: body.valueTotalEstimate || null,
      hsDealId: body.hsDealId || null,
      // Project channels
      projectChannels: body.projectChannels || null,
    });

    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create project" },
      { status: 500 }
    );
  }
}
