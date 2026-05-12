import { describe, expect, it } from "vitest";
import { canAccessDashboard } from "@/lib/auth/client-access";

describe("canAccessDashboard", () => {
  it("allows admin access level", () => {
    expect(canAccessDashboard({ access: { level: "admin" } })).toBe(true);
  });

  it("allows the explicit super user email override", () => {
    expect(canAccessDashboard({ user: { email: "super@timetrack.id" }, access: { level: "restricted" } })).toBe(true);
  });

  it("normalizes email casing and whitespace", () => {
    expect(canAccessDashboard({ user: { email: "  SUPER@TIMETRACK.ID  " } })).toBe(true);
  });

  it("rejects full access users that are not admin or the email override", () => {
    expect(canAccessDashboard({ user: { email: "full@example.com" }, access: { level: "full", can_view_all: true } })).toBe(false);
  });

  it("rejects restricted users that are not the email override", () => {
    expect(canAccessDashboard({ user: { email: "restricted@example.com" }, access: { level: "restricted" } })).toBe(false);
  });

  it("rejects missing sessions", () => {
    expect(canAccessDashboard(null)).toBe(false);
  });
});
