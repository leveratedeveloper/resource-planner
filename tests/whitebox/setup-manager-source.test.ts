import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SetupManager source", () => {
  const source = readFileSync("components/setup/SetupManager.tsx", "utf8");

  it("uses Radix TabsContent for tab panels", () => {
    expect(source).toContain("TabsContent");
    expect(source).toContain('value="brands"');
    expect(source).toContain('value="projects"');
    expect(source).toContain('value="resources"');
  });

  it("keeps tab panels scrollable within the setup modal", () => {
    expect(source).toContain("min-h-0 flex-1 overflow-y-auto");
  });
});
