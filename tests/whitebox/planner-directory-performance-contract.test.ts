import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner directory performance contract", () => {
  it("does not await the sync engine in the login route", () => {
    const source = readFileSync("app/api/auth/login/route.ts", "utf8");

    expect(source).toContain("requestPlannerDirectorySyncIfStale");
    expect(source).not.toContain("await runPlannerDirectorySync");
  });
});
