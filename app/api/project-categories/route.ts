import { NextResponse } from "next/server";
import { getAllProjectCategories, createProjectCategory } from "@/lib/db/queries";

export async function GET() {
  try {
    const projectCategories = await getAllProjectCategories();
    return NextResponse.json({ success: true, data: projectCategories });
  } catch (error) {
    console.error("Failed to fetch project categories:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch project categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    const projectCategory = await createProjectCategory({
      name: body.name,
      description: body.description || null,
      displayOrder: body.displayOrder || 0,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });

    return NextResponse.json({ success: true, data: projectCategory }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create project category" },
      { status: 500 }
    );
  }
}
