import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIMELINE_DIMENSIONS } from "@/lib/timeline-v2/layout";

// Drift guard for the dimension token system (DESIGN.md §2.2): the CSS tokens
// in app/globals.css and the px mirror in lib/timeline-v2/layout.ts must agree.
// Editing one side without the other fails here.

function readCssTokenRem(css: string, token: string): number {
  const match = css.match(new RegExp(`${token}:\\s*([0-9.]+)rem`));
  if (!match) throw new Error(`Token ${token} not found in globals.css`);
  return parseFloat(match[1]);
}

describe("timeline dimension tokens", () => {
  const css = readFileSync("app/globals.css", "utf8");

  it.each([
    ["--spacing-timeline-row", TIMELINE_DIMENSIONS.row],
    ["--spacing-timeline-lane", TIMELINE_DIMENSIONS.lane],
    ["--spacing-timeline-header", TIMELINE_DIMENSIONS.header],
    ["--spacing-timeline-resource-col", TIMELINE_DIMENSIONS.resourceCol.default],
    ["--spacing-timeline-resource-col-min", TIMELINE_DIMENSIONS.resourceCol.min],
    ["--spacing-timeline-resource-col-max", TIMELINE_DIMENSIONS.resourceCol.max],
  ])("%s matches the TS px mirror", (token, expectedPx) => {
    expect(readCssTokenRem(css, token) * 16).toBe(expectedPx);
  });

  it("keeps the resize clamp inside the token bounds", () => {
    expect(TIMELINE_DIMENSIONS.resourceCol.min).toBeLessThan(TIMELINE_DIMENSIONS.resourceCol.default);
    expect(TIMELINE_DIMENSIONS.resourceCol.default).toBeLessThan(TIMELINE_DIMENSIONS.resourceCol.max);
  });
});
