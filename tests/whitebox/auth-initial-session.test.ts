import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  clearAuthSessionAfterLogout,
  shouldFetchAuthSession,
} from "@/context/AuthContext";

describe("auth initial session hydration", () => {
  it("skips the first session fetch when the provider receives server session data", () => {
    expect(
      shouldFetchAuthSession({
        hasInitialSession: true,
        hasResolvedInitialSession: true,
      })
    ).toBe(false);
  });

  it("fetches a session when no server session data was resolved", () => {
    expect(
      shouldFetchAuthSession({
        hasInitialSession: false,
        hasResolvedInitialSession: false,
      })
    ).toBe(true);
  });

  it("keeps the session query logged out after clearing cached planner data", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["session"], {
      user: { id: 1, email: "user@example.com" },
    });
    queryClient.setQueryData(["employees"], [{ id: "employee-1" }]);

    clearAuthSessionAfterLogout(queryClient);

    expect(queryClient.getQueryData(["session"])).toBeNull();
    expect(queryClient.getQueryData(["employees"])).toBeUndefined();
  });
});
