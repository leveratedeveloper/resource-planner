import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  fetchTimetrackCampaignByUuid,
  fetchTimetrackPitchByUuid,
} from "@/lib/planner-directory/timetrack-source";
import {
  mapCampaignToProject,
  mapPitchToProject,
} from "@/lib/projects/project-detail-mapper";

type RouteParams = { type: string; id: string };
type ProjectType = "campaigns" | "pitches";

function isProjectType(type: string): type is ProjectType {
  return type === "campaigns" || type === "pitches";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { type, id } = await params;
    if (!isProjectType(type)) {
      return NextResponse.json(
        { success: false, error: "Unsupported project type" },
        { status: 400 }
      );
    }

    if (type === "campaigns") {
      const campaign = await fetchTimetrackCampaignByUuid(session, id);
      if (!campaign) {
        return NextResponse.json(
          { success: false, error: "Campaign not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: mapCampaignToProject(campaign) });
    }

    const pitch = await fetchTimetrackPitchByUuid(session, id);
    if (!pitch) {
      return NextResponse.json(
        { success: false, error: "Pitch not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: mapPitchToProject(pitch) });
  } catch (error) {
    console.error("[Project Detail API] Failed to fetch project detail:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch project detail",
      },
      { status: 500 }
    );
  }
}
