import { describe, expect, it, vi } from "vitest";
import { createRequestTiming } from "@/lib/observability/request-timing";

describe("request timing", () => {
  it("logs phase and total durations with structured context", () => {
    const info = vi.fn();
    const timing = createRequestTiming("login", {
      now: vi
        .fn()
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(135)
        .mockReturnValueOnce(180),
      info,
    });

    timing.phase("credential_exchange");
    timing.total({ result: "success" });

    expect(info).toHaveBeenCalledWith("[Timing]", {
      flow: "login",
      phase: "credential_exchange",
      durationMs: 35,
    });
    expect(info).toHaveBeenCalledWith("[Timing]", {
      flow: "login",
      phase: "total",
      durationMs: 80,
      result: "success",
    });
  });
});
