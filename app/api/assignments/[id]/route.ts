import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assignmentsDb } from "@/lib/mysql-assignments/db";

/**
 * DELETE /api/assignments/[id]
 * Removes an engagement (planner_assignments row) by its assignment_uuid.
 * Monthly allocations cascade via the FK ON DELETE CASCADE.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!session.access.can_view_all)
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const { id } = await params;
  await assignmentsDb.execute(`DELETE FROM planner_assignments WHERE assignment_uuid = $1`, [id]);
  return NextResponse.json({ success: true });
}
