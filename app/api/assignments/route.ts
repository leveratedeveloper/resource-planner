import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getEngagements } from "@/lib/assignments/assignment-reads";
import { upsertAssignment } from "@/lib/assignments/assignment-commands";
import { AssignmentValidationError } from "@/lib/assignments/assignment-validation";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const projectKey = searchParams.get("projectKey") ?? undefined;
  const projectKeys = searchParams.getAll("projectKeys");

  let effectiveEmployee = employeeId;
  if (!session.access.can_view_all && session.employee?.uuid) effectiveEmployee = session.employee.uuid;

  const { engagements, allocations } = await getEngagements({
    employee_uuid: effectiveEmployee,
    project_key: projectKey,
    project_keys: projectKeys.length ? projectKeys : undefined,
  });
  return NextResponse.json({ success: true, engagements, allocations });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!session.access.can_view_all)
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const body = await request.json();
  try {
    const assignmentUuid = await upsertAssignment({
      employeeUuid: body.employeeUuid,
      projectKey: body.projectKey,
      span: body.span,
      monthlyHours: body.monthlyHours ?? {},
      status: body.status,
      note: body.note ?? null,
      kind: body.kind ?? "plan",
      mode: body.mode ?? "replace",
      actingUserUuid: session.employee?.uuid ?? null,
    });
    return NextResponse.json({ success: true, assignmentUuid });
  } catch (err) {
    if (err instanceof AssignmentValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
