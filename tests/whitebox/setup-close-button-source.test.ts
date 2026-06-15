import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/HomeClient.tsx"), "utf8");

describe("setup modal close button source", () => {
  it("uses the rounded-square close button shape used by detail dialogs", () => {
    const closeButtonMatch = source.match(/<DialogClose className="([^"]+)">\s*<XIcon/s);

    expect(closeButtonMatch).not.toBeNull();
    expect(closeButtonMatch?.[1]).toContain("rounded-xl");
    expect(closeButtonMatch?.[1]).not.toContain("rounded-full");
  });
});
