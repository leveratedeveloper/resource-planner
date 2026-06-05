import { describe, expect, it } from "vitest";
import { chunkRowsForBatching, getPlannerDirectoryBatchSize } from "@/lib/planner-directory/write-batches";

describe("planner directory write batching", () => {
  it("caps PostgreSQL batches using a parameter budget", () => {
    expect(getPlannerDirectoryBatchSize({ columnCount: 20, dialect: "postgresql" })).toBeLessThanOrEqual(250);
    expect(getPlannerDirectoryBatchSize({ columnCount: 20, dialect: "postgresql" })).toBeGreaterThan(0);
  });

  it("splits large row sets into stable chunks", () => {
    const rows = Array.from({ length: 600 }, (_, index) => ({ id: index + 1 }));
    const chunks = chunkRowsForBatching(rows, 250);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(250);
    expect(chunks[1]).toHaveLength(250);
    expect(chunks[2]).toHaveLength(100);
  });
});
