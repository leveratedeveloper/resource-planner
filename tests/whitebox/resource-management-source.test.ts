import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ResourceManagement source", () => {
  const source = readFileSync("components/setup/ResourceManagement.tsx", "utf8");

  it("imports cn because employee detail status badges use conditional classes", () => {
    expect(source).toContain('import { cn } from "@/lib/utils";');
    expect(source).toContain("className={cn(");
  });
});
