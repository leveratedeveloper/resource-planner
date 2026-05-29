import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";
import type { MySqlProjectDeliverable } from "@/lib/types/mysql";

type RouteParams = { type: string; id: string };
type ProjectType = "campaigns" | "pitches";

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
        { success: false, error: "Unsupported project type", data: [] },
        { status: 400 }
      );
    }

    const client = getMySqlApiClient(async () => session.access_token);
    const response = await client.getProjectDeliverables(type, id);

    if (response.error) {
      console.error("[Project Deliverables API] Upstream API error", {
        projectType: type,
        projectId: id,
        status: response.status,
        errorType: response.error.type,
      });
      return NextResponse.json(
        {
          success: false,
          error: response.error.message,
          errorType: response.error.type,
          data: [],
        },
        { status: response.status === 200 ? 500 : response.status }
      );
    }

    const actualData = unwrapDeliverables(response.data);

    return NextResponse.json({
      success: response.success ?? true,
      data: actualData.map((del) => ({
        id: String(del.id),
        channelId: del.channel_id ? String(del.channel_id) : null,
        deliverableName: del.deliverable_name,
        deliverableNameNew: del.deliverable_name_new ?? null,
        flag: del.flag ?? "active",
        channel: del.channel
          ? {
          id: String(del.channel.id),
          channelName: del.channel.channel_name_new || del.channel.channel_name,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch project deliverables:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch project deliverables",
        data: [],
      },
      { status: 500 }
    );
  }
}

function isProjectType(type: string): type is ProjectType {
  return type === "campaigns" || type === "pitches";
}

function unwrapDeliverables(data: unknown): MySqlProjectDeliverable[] {
  if (Array.isArray(data)) return data as MySqlProjectDeliverable[];
  if (
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    Array.isArray((data as { data: unknown }).data)
  ) {
    return (data as { data: MySqlProjectDeliverable[] }).data;
  }
  return [];
}
