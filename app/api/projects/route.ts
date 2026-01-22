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
    
    const project = await createProject({
      brandId: body.brandId,
      businessUnitId: body.businessUnitId || null,
      projectTypeId: body.projectTypeId || null,
      name: body.name,
      projectNumber: body.projectNumber || null,
      description: body.description || null,
      color: body.color || "#10b981",
      budget: body.budget || null,
      currency: body.currency || "USD",
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      status: body.status || "active",
      createdById: body.createdById || null,
      notes: body.notes || null,
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
