import type { APIRequestContext, APIResponse } from "@playwright/test";
import { CleanupRegistry } from "./cleanupRegistry";
import type { CreatedAssignment, CreatedEmployee, TestEnv } from "./types";

type EmployeePayload = {
  fullName: string;
  position: string;
  weeklyCapacity?: number;
  employmentStatus?: "active" | "inactive" | "contractor";
  visibility?: "active" | "archived";
  employeeNumber?: string;
  email?: string;
};

type AssignmentPayload = {
  employeeId: string;
  projectId: string | null;
  startDate: string;
  endDate: string;
  hoursPerDay: string;
  isTimeOff?: boolean;
  category?: string | null;
  isBillable?: boolean;
  status?: "draft" | "confirmed" | "completed";
  note?: string | null;
};

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function parseJson<T>(response: APIResponse, context: string): Promise<T> {
  const body = await response.text();
  if (!response.ok()) {
    throw new Error(`${context} failed with status ${response.status()}: ${body.slice(0, 500)}`);
  }

  return JSON.parse(body) as T;
}

export class TestDataManager {
  private projectChecked = false;

  constructor(
    private readonly request: APIRequestContext,
    private readonly env: TestEnv,
    private readonly cleanup: CleanupRegistry,
    private readonly namespace: string
  ) {}

  async ensureFixtureProjectExists(): Promise<void> {
    if (this.projectChecked) {
      return;
    }

    const response = await this.request.get(`/api/projects/${this.env.e2eProjectId}`);
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `E2E_PROJECT_ID (${this.env.e2eProjectId}) is not valid or not accessible. Status=${response.status()} Body=${body.slice(0, 300)}`
      );
    }

    this.projectChecked = true;
  }

  async createNamespacedEmployee(partial: Partial<EmployeePayload> = {}): Promise<CreatedEmployee> {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const fullName = partial.fullName ?? `${this.namespace}_EMP_${suffix}`;

    const payload: EmployeePayload = {
      fullName,
      position: partial.position ?? "Automation Engineer",
      weeklyCapacity: partial.weeklyCapacity ?? 40,
      employmentStatus: partial.employmentStatus ?? "active",
      visibility: partial.visibility ?? "active",
      employeeNumber: partial.employeeNumber ?? `${this.namespace}_NO_${suffix}`,
      email: partial.email ?? `${this.namespace.toLowerCase()}_${suffix.toLowerCase()}@example.test`,
    };

    const response = await this.request.post("/api/employees", {
      data: payload,
    });

    const parsed = await parseJson<{ success: boolean; data: CreatedEmployee }>(
      response,
      "createNamespacedEmployee"
    );

    this.cleanup.registerEmployee(parsed.data.id);
    return parsed.data;
  }

  async createAssignment(payload: AssignmentPayload): Promise<CreatedAssignment> {
    await this.ensureFixtureProjectExists();

    const response = await this.request.post("/api/assignments", {
      data: {
        employeeId: payload.employeeId,
        projectId: payload.projectId,
        taskId: null,
        startDate: payload.startDate,
        endDate: payload.endDate,
        hoursPerDay: payload.hoursPerDay,
        allocationPercentage: null,
        isTimeOff: payload.isTimeOff ?? false,
        timeOffTypeId: null,
        category: payload.category ?? "Development",
        isBillable: payload.isBillable ?? true,
        status: payload.status ?? "draft",
        note: payload.note ?? null,
        createdById: null,
      },
    });

    const parsed = await parseJson<{ success: boolean; data: CreatedAssignment }>(
      response,
      "createAssignment"
    );

    this.cleanup.registerAssignment(parsed.data.id);
    return parsed.data;
  }

  async seedEmployeeWithProject(): Promise<{ employee: CreatedEmployee; placeholderAssignment: CreatedAssignment }> {
    const employee = await this.createNamespacedEmployee();
    const today = toISODate(new Date());

    const placeholderAssignment = await this.createAssignment({
      employeeId: employee.id,
      projectId: this.env.e2eProjectId,
      startDate: today,
      endDate: today,
      hoursPerDay: "0",
      status: "draft",
      note: "E2E placeholder assignment",
    });

    return { employee, placeholderAssignment };
  }

  async seedOverallocationConflict(): Promise<{
    employee: CreatedEmployee;
    assignmentIds: [string, string];
  }> {
    const employee = await this.createNamespacedEmployee({ weeklyCapacity: 40 });
    const today = new Date();
    const start = toISODate(today);
    const end = toISODate(today);

    const assignmentA = await this.createAssignment({
      employeeId: employee.id,
      projectId: this.env.e2eProjectId,
      startDate: start,
      endDate: end,
      hoursPerDay: "8",
      status: "confirmed",
      note: "E2E conflict assignment A",
    });

    const assignmentB = await this.createAssignment({
      employeeId: employee.id,
      projectId: this.env.e2eProjectId,
      startDate: start,
      endDate: end,
      hoursPerDay: "8",
      status: "confirmed",
      note: "E2E conflict assignment B",
    });

    return {
      employee,
      assignmentIds: [assignmentA.id, assignmentB.id],
    };
  }
}
