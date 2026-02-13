import type { APIRequestContext } from "@playwright/test";
import type { CleanupFailure } from "./types";

const RETRY_DELAYS_MS = [200, 600, 1200];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CleanupRegistry {
  private readonly assignmentIds = new Set<string>();
  private readonly employeeIds = new Set<string>();
  private readonly failures = new Map<string, CleanupFailure>();

  registerAssignment(id: string) {
    this.assignmentIds.add(id);
  }

  registerEmployee(id: string) {
    this.employeeIds.add(id);
  }

  private recordFailure(failure: CleanupFailure) {
    this.failures.set(`${failure.entityType}:${failure.entityId}`, failure);
  }

  private clearFailure(entityType: CleanupFailure["entityType"], entityId: string) {
    this.failures.delete(`${entityType}:${entityId}`);
  }

  private async deleteWithRetry(
    request: APIRequestContext,
    path: string,
    entityType: CleanupFailure["entityType"],
    entityId: string
  ): Promise<boolean> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      const response = await request.delete(path);

      if (response.ok() || response.status() === 404) {
        this.clearFailure(entityType, entityId);
        return true;
      }

      if (attempt === RETRY_DELAYS_MS.length) {
        const body = await response.text();
        this.recordFailure({
          entityType,
          entityId,
          reason: `status=${response.status()} body=${body.slice(0, 400)}`,
        });
        return false;
      }

      await sleep(RETRY_DELAYS_MS[attempt]);
    }

    return false;
  }

  async cleanupAll(request: APIRequestContext) {
    for (const id of [...this.assignmentIds]) {
      const deleted = await this.deleteWithRetry(request, `/api/assignments/${id}`, "assignment", id);
      if (deleted) {
        this.assignmentIds.delete(id);
      }
    }

    for (const id of [...this.employeeIds]) {
      const deleted = await this.deleteWithRetry(request, `/api/employees/${id}`, "employee", id);
      if (deleted) {
        this.employeeIds.delete(id);
      }
    }
  }

  hasPendingEntities() {
    return this.assignmentIds.size > 0 || this.employeeIds.size > 0;
  }

  hasFailures() {
    return this.failures.size > 0;
  }

  getFailureDetails() {
    return [...this.failures.values()]
      .map((failure) => `${failure.entityType}:${failure.entityId} => ${failure.reason}`)
      .join("\n");
  }

  assertNoFailures() {
    if (this.failures.size === 0) {
      return;
    }

    const details = this.getFailureDetails();

    throw new Error(`Cleanup failed for one or more entities:\n${details}`);
  }
}
