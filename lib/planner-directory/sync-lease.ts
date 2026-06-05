import { assignmentsDb, getDbClient } from "@/lib/mysql-assignments/db";

type PlannerDirectoryConnection = {
  query(sql: string, params?: unknown[]): Promise<unknown>;
  release(): Promise<void>;
};

type PlannerDirectoryDb = {
  getConnection(): Promise<PlannerDirectoryConnection>;
};

type LeaseAcquireResult = {
  acquired: boolean;
  owner: string;
  leaseKey: string;
  reason?: "already_running" | "busy";
  release: () => Promise<void>;
};

type LeaseOptions = {
  leaseKey?: string;
  db?: PlannerDirectoryDb;
};

const DEFAULT_LEASE_KEY = "planner-directory-sync";
const DEFAULT_DB = assignmentsDb as unknown as PlannerDirectoryDb;

function readRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    if (result.length > 0 && Array.isArray(result[0])) {
      return result[0] as T[];
    }
    if (result.every((entry) => typeof entry === "object")) {
      return result as T[];
    }
  }

  if (result && typeof result === "object" && "rows" in result) {
    return ((result as { rows?: T[] }).rows ?? []) as T[];
  }

  return [];
}

function firstRow<T>(result: unknown): T | null {
  return readRows<T>(result)[0] ?? null;
}

function getAcquireSql(leaseKey: string) {
  if (getDbClient() === "postgresql") {
    return {
      sql: "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
      params: [leaseKey],
    };
  }

  return {
    sql: "SELECT GET_LOCK(?, 0) AS acquired",
    params: [leaseKey],
  };
}

function getReleaseSql(leaseKey: string) {
  if (getDbClient() === "postgresql") {
    return {
      sql: "SELECT pg_advisory_unlock(hashtext($1)) AS released",
      params: [leaseKey],
    };
  }

  return {
    sql: "SELECT RELEASE_LOCK(?) AS released",
    params: [leaseKey],
  };
}

export function createPlannerDirectoryLeaseManager(db: PlannerDirectoryDb = DEFAULT_DB, leaseKey = DEFAULT_LEASE_KEY) {
  return {
    async acquire(owner: string): Promise<LeaseAcquireResult> {
      const connection = await db.getConnection();
      const acquire = getAcquireSql(leaseKey);
      const result = await connection.query(acquire.sql, acquire.params);
      const row = firstRow<{ acquired?: number | boolean }>(result);
      const acquired = row?.acquired === 1 || row?.acquired === true;

      return {
        acquired,
        owner,
        leaseKey,
        reason: acquired ? undefined : "busy",
        release: async () => {
          if (!acquired) {
            await connection.release();
            return;
          }
          const release = getReleaseSql(leaseKey);
          await connection.query(release.sql, release.params);
          await connection.release();
        },
      };
    },
  };
}

export async function acquirePlannerDirectoryLease(
  owner: string,
  options: LeaseOptions = {}
): Promise<LeaseAcquireResult> {
  return createPlannerDirectoryLeaseManager(options.db ?? DEFAULT_DB, options.leaseKey ?? DEFAULT_LEASE_KEY).acquire(owner);
}
