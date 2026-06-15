import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId") || undefined;
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const offset = Number.parseInt(searchParams.get("offset") || "0", 10);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    const projects = await plannerDirectoryRepository.listProjects();
    const filtered = projects.filter((project) => {
      if (brandId && project.brandId !== brandId) return false;
      if (!search) return true;
      return project.name.toLowerCase().includes(search);
    });

    const data = filtered.slice(offset, offset + limit).map((project) => ({
      id: project.sourceProjectId,
      brandId: project.brandId || "",
      businessUnitId: null,
      projectCategoryId: null,
      projectTypeId: null,
      projectType: project.sourceType,
      entity: null,
      name: project.name,
      projectNumber: null,
      description: null,
      color: project.color || "#64748b",
      budget: null,
      asf: null,
      grandTotal: null,
      currency: "IDR",
      ioFile: null,
      flag: null,
      quotationReference: null,
      startDate: project.startDate,
      endDate: project.endDate,
      status:
        project.status === "active" ||
        project.status === "on_hold" ||
        project.status === "completed" ||
        project.status === "cancelled"
          ? project.status
          : "planning",
      createdById: null,
      notes: null,
      region: null,
      submitDate: project.sourceType === "pitch" ? project.submitDate : null,
      pitchStatus: null,
      valueTotalEstimate: null,
      hsDealId: null,
      createdAt: project.sourceUpdatedAt ?? project.syncedAt,
      updatedAt: project.sourceUpdatedAt ?? project.syncedAt,
      brand: project.brandId
        ? {
            id: project.brandId,
            name: `Brand ${project.brandId}`,
            color: "#64748b",
          }
        : undefined,
      businessUnit: undefined,
      projectCategory: undefined,
      createdBy: undefined,
      assignments: [],
      projectChannels: [],
    }));

    return NextResponse.json({
      success: true,
      data,
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
    });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch projects",
        data: [],
      },
      { status: 500 }
    );
  }
}
