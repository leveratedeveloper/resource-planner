type TimingInfo = (message: string, context: Record<string, unknown>) => void;

export function createRequestTiming(
  flow: string,
  {
    now = () => performance.now(),
    info = console.info,
  }: {
    now?: () => number;
    info?: TimingInfo;
  } = {}
) {
  const startedAt = now();
  let phaseStartedAt = startedAt;

  function logPhase(phase: string, context: Record<string, unknown> = {}) {
    const endedAt = now();

    info("[Timing]", {
      flow,
      phase,
      durationMs: Math.round(endedAt - phaseStartedAt),
      ...context,
    });
    phaseStartedAt = endedAt;
  }

  return {
    phase: logPhase,
    total(context: Record<string, unknown> = {}) {
      const endedAt = now();

      info("[Timing]", {
        flow,
        phase: "total",
        durationMs: Math.round(endedAt - startedAt),
        ...context,
      });
    },
  };
}
