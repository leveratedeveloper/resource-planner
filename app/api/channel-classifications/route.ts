import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelClassifications } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const channels = await db.query.channelClassifications.findMany({
      where: eq(channelClassifications.flag, 'active'),
      orderBy: [asc(channelClassifications.displayOrder), asc(channelClassifications.channelName)],
    });

    return NextResponse.json({ success: true, data: channels });
  } catch (error) {
    console.error("Failed to fetch channel classifications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch channel classifications" },
      { status: 500 }
    );
  }
}
