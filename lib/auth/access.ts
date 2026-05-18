export type AccessSession = {
  user?: {
    email?: string | null;
  } | null;
  access?: {
    level?: string | null;
    can_view_all?: boolean | null;
  } | null;
} | null | undefined;

export const DASHBOARD_EMAIL_OVERRIDE = "super@timetrack.id";

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
  if (normalizeAccessValue(session?.access?.level) === "admin") {
    return true;
  }

  return normalizeAccessValue(session?.user?.email) === DASHBOARD_EMAIL_OVERRIDE;
}
