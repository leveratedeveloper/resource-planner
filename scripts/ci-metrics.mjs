#!/usr/bin/env node

import { readFile, appendFile } from "node:fs/promises";

const reportPath = process.env.PW_JSON_REPORT || "test-results/json/results.json";

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec}s`;
}

async function main() {
  let report;
  try {
    const raw = await readFile(reportPath, "utf8");
    report = JSON.parse(raw);
  } catch {
    console.warn(`[ci-metrics] Report not found at ${reportPath}. Skipping metrics output.`);
    return;
  }

  const stats = report.stats || {};
  const expected = Number(stats.expected || 0);
  const unexpected = Number(stats.unexpected || 0);
  const flaky = Number(stats.flaky || 0);
  const skipped = Number(stats.skipped || 0);
  const duration = Number(stats.duration || 0);

  const lines = [
    "## Playwright Metrics",
    `- Expected passed: ${expected}`,
    `- Unexpected failed: ${unexpected}`,
    `- Flaky: ${flaky}`,
    `- Skipped: ${skipped}`,
    `- Duration: ${formatDuration(duration)}`,
  ];

  const output = `${lines.join("\n")}\n`;
  console.log(output);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${output}\n`, "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
