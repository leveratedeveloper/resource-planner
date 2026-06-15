const baseUrl = process.env.PLANNER_BENCHMARK_BASE_URL || "http://localhost:3000";
const cookie = process.env.PLANNER_BENCHMARK_COOKIE || "";

const endpoints = [
  "/api/planner/timeline?viewMode=quarter&startDate=2026-04-01&endDate=2026-06-30",
  "/api/planner/home-bootstrap?viewMode=quarter&startDate=2026-04-01&endDate=2026-06-30&employeeLimit=24&employeeOffset=0",
];

async function measure(endpoint: string) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: cookie ? { cookie } : {},
  });
  const text = await response.text();
  const durationMs = Math.round(performance.now() - startedAt);

  return {
    endpoint,
    status: response.status,
    durationMs,
    bytes: Buffer.byteLength(text, "utf8"),
  };
}

async function main() {
  for (const endpoint of endpoints) {
    const result = await measure(endpoint);
    console.log(JSON.stringify(result));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
