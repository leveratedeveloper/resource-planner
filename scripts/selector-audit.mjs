#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TESTS_DIR = path.join(ROOT, "tests");
const SRC_DIRS = [path.join(ROOT, "components"), path.join(ROOT, "app")];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function collectTestIdsFromTests(content) {
  const ids = new Set();
  const patterns = [
    /getByTestId\(["'`]([^"'`]+)["'`]\)/g,
    /\[data-testid=\\"([^\\"\]]+)\\"\]/g,
    /\[data-testid='([^'\]]+)'\]/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      ids.add(match[1]);
    }
  }

  return ids;
}

function collectTestIdsFromSource(content) {
  const ids = new Set();
  const pattern = /data-testid=\"([^\"]+)\"/g;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    ids.add(match[1]);
  }

  return ids;
}

async function main() {
  const testFiles = (await walk(TESTS_DIR)).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
  const srcFiles = (
    await Promise.all(SRC_DIRS.map(async (dir) => walk(dir)))
  )
    .flat()
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

  const requiredIds = new Set();
  for (const file of testFiles) {
    const content = await readFile(file, "utf8");
    for (const id of collectTestIdsFromTests(content)) {
      requiredIds.add(id);
    }
  }

  const availableIds = new Set();
  for (const file of srcFiles) {
    const content = await readFile(file, "utf8");
    for (const id of collectTestIdsFromSource(content)) {
      availableIds.add(id);
    }
  }

  const missing = [...requiredIds].filter((id) => !availableIds.has(id));

  if (missing.length > 0) {
    console.error("Selector audit failed. Missing data-testid values:");
    for (const id of missing) {
      console.error(`- ${id}`);
    }
    process.exit(1);
  }

  console.log(`Selector audit passed. ${requiredIds.size} tested selectors are present.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
