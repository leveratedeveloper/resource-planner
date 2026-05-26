export type AccessSession = {
  user?: {
    email?: string | null;
  } | null;
  access?: {
    level?: string | null;
    can_view_all?: boolean | null;
  } | null;
} | null | undefined;

export function normalizeAccessValue(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function isFullAccess(session: AccessSession): boolean {
  if (session?.access?.can_view_all === true) {
    return true;
  }

  return normalizeAccessValue(session?.access?.level) === "full";
}

export function canAccessDashboard(session: AccessSession): boolean {
  // Dashboard access requires full or admin access level
  const level = normalizeAccessValue(session?.access?.level);
  return level === "admin" || level === "full";
}
