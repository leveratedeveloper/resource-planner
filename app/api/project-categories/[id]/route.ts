import { NextResponse } from "next/server";
import { getProjectCategoryById, updateProjectCategory, deleteProjectCategory } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectCategory = await getProjectCategoryById(id);

    if (!projectCategory) {
      return NextResponse.json(
        { success: false, error: "Project category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: projectCategory });
  } catch (error) {
    console.error("Failed to fetch project category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch project category" },
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

    const projectCategory = await updateProjectCategory(id, {
      name: body.name,
      description: body.description,
      displayOrder: body.displayOrder,
      isActive: body.isActive,
    });

    if (!projectCategory) {
      return NextResponse.json(
        { success: false, error: "Project category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: projectCategory });
  } catch (error) {
    console.error("Failed to update project category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update project category" },
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
    await deleteProjectCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete project category" },
      { status: 500 }
    );
  }
}
