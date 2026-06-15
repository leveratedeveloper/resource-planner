import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("assignments database connection management", () => {
  it("uses a PostgreSQL pool instead of creating a client per query", () => {
    const source = readFileSync("lib/mysql-assignments/db.ts", "utf8");

    expect(source).toContain("let _postgresPool");
    expect(source).toContain("async function getPostgresPool");
    expect(source).toContain("return _postgresPool");
    expect(source).not.toContain("PostgreSQL client for serverless - ALWAYS create new connection");
  });
});
