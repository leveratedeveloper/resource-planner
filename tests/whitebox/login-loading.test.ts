import { describe, expect, it } from "vitest";
import { shouldDisableLoginSubmit } from "@/lib/auth/login-loading";

describe("login loading state", () => {
  it("keeps submit disabled while auth resolution or login submission is loading", () => {
    expect(shouldDisableLoginSubmit({ isAuthLoading: true, isSubmitting: false })).toBe(true);
    expect(shouldDisableLoginSubmit({ isAuthLoading: false, isSubmitting: true })).toBe(true);
    expect(shouldDisableLoginSubmit({ isAuthLoading: false, isSubmitting: false })).toBe(false);
  });
});
