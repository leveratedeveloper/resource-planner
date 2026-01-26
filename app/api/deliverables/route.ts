import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deliverables } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");

    let results;
    if (channelId) {
      results = await db.query.deliverables.findMany({
        where: and(
          eq(deliverables.channelId, channelId),
          eq(deliverables.flag, 'active')
        ),
        orderBy: [asc(deliverables.deliverableName)],
      });
    } else {
      results = await db.query.deliverables.findMany({
        where: eq(deliverables.flag, 'active'),
        orderBy: [asc(deliverables.deliverableName)],
      });
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Failed to fetch deliverables:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch deliverables" },
      { status: 500 }
    );
  }
}
