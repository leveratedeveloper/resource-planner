import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { runPlannerDirectorySync } from "@/lib/planner-directory/sync-engine";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const syncMode =
    body?.syncMode === "full_backfill" || body?.syncMode === "incremental_refresh" || body?.syncMode === "targeted_repair"
      ? body.syncMode
      : "incremental_refresh";

  const result = await runPlannerDirectorySync({
    session,
    syncMode,
    triggerSource: "admin_route",
    triggeredBy: session.employee.uuid,
    scope: body?.scope ?? undefined,
  });

  return NextResponse.json({
    success: true,
    data: result,
  });
}
