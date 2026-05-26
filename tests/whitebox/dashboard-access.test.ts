import { describe, expect, it } from "vitest";
import { canAccessDashboard } from "@/lib/auth/client-access";

describe("canAccessDashboard", () => {
  it("allows admin access level", () => {
    expect(canAccessDashboard({ access: { level: "admin" } })).toBe(true);
  });

  it("allows full access level", () => {
    expect(canAccessDashboard({ user: { email: "full@example.com" }, access: { level: "full", can_view_all: true } })).toBe(true);
  });

  it("rejects restricted users even with previously backdoor email", () => {
    expect(canAccessDashboard({ user: { email: "super@timetrack.id" }, access: { level: "restricted" } })).toBe(false);
  });

  it("rejects email alone without access level", () => {
    expect(canAccessDashboard({ user: { email: "  SUPER@TIMETRACK.ID  " } })).toBe(false);
  });

  it("rejects restricted users that are not the email override", () => {
    expect(canAccessDashboard({ user: { email: "restricted@example.com" }, access: { level: "restricted" } })).toBe(false);
  });

  it("rejects missing sessions", () => {
    expect(canAccessDashboard(null)).toBe(false);
  });
});
