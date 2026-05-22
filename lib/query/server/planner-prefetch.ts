import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getActualAssignments, getAssignments } from "@/lib/mysql-assignments/queries";
import { toLocalDateString } from "@/lib/utils";
import { sortEmployeeRecordsByName } from "@/lib/timeline/employees";
import type { SessionData } from "@/lib/auth/session";
import type { PublicSessionData } from "@/context/AuthContext";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Department } from "@/lib/query/hooks/useDepartments";
import type { Project } from "@/lib/query/hooks/useProjects";
import {
  summarizeMonthlyActualAssignments,
  summarizeMonthlyAssignments,
  type PlannerTimelineRequest,
  type PlannerTimelineResponse,
} from "@/lib/timeline/planner-loading";

export const INITIAL_EMPLOYEE_PAGE_SIZE = 12;

export function toPublicSession(session: SessionData | null): PublicSessionData | null {
  if (!session) {
    return null;
  }

  return {
    user: session.user,
    employee: session.employee,
    access: session.access,
  };
}

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === "object" ? (value as ApiRecord) : {};
}

function getApiData(response: unknown): ApiRecord[] {
  const responseRecord = asRecord(response);
  if (responseRecord.error) {
    return [];
  }

  const dataRecord = asRecord(responseRecord.data);
  const nestedData = dataRecord.data;
  const directData = responseRecord.data;

  if (Array.isArray(nestedData)) {
    return nestedData as ApiRecord[];
  }
  if (Array.isArray(directData)) {
    return directData as ApiRecord[];
  }

  return [];
}

function getApiMeta(response: unknown): ApiRecord {
  const responseRecord = asRecord(response);
  const dataRecord = asRecord(responseRecord.data);

  return asRecord(dataRecord.meta || responseRecord.meta);
}

function assertApiSuccess(response: unknown, label: string): void {
  const responseRecord = asRecord(response);
  if (responseRecord.error) {
    const errorRecord = asRecord(responseRecord.error);
    throw new Error(`${label} prefetch failed: ${text(errorRecord.message, "unknown error")}`);
  }
}

function randomColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffff;
  }
  return `#${hash.toString(16).padStart(6, "0")}`;
}

function text(value: unknown, fallback = ""): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : fallback;
}

function stringValue(value: unknown, fallback = ""): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function nullableText(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

function dateValue(value: unknown): string {
  if (value instanceof Date) return toLocalDateString(value);
  if (typeof value === "string") return value.slice(0, 10);
  return "";
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function transformEmployee(emp: ApiRecord): Employee {
  const department = asRecord(emp.department);
  const supervisor = asRecord(emp.supervisor);

  return {
    id: text(emp.uuid),
    employeeNumber: nullableText(emp.nik),
    fullName: text(emp.full_name),
    nickname: nullableText(emp.nickname),
    email: null,
    photo: nullableText(emp.photo),
    position: text(emp.position),
    departmentId: String(emp.dept_id),
    businessUnitId: null,
    directSupervisorId: emp.direct_supervisor ? String(emp.direct_supervisor) : null,
    weeklyCapacity: 40,
    workStartDate: nullableText(emp.work_start_date),
    dateOfBirth: nullableText(emp.dob),
    employmentStatus: emp.flag === "active" ? "active" : "inactive",
    visibility: emp.status === "visible" ? "active" : "archived",
    gender: emp.gender === "MALE" || emp.gender === "FEMALE" ? emp.gender : null,
    createdAt: text(emp.created_at),
    updatedAt: text(emp.updated_at),
    department: Object.keys(department).length
      ? {
          id: String(department.id),
          name: text(department.department_name),
          color: text(department.color, randomColor(String(department.id))),
        }
      : undefined,
    businessUnit: undefined,
    supervisor: Object.keys(supervisor).length
      ? {
          id: text(supervisor.uuid),
          fullName: text(supervisor.full_name),
          position: text(supervisor.position),
        }
      : undefined,
  };
}

function transformBrand(brand: ApiRecord): Brand {
  const brandId = String(brand.brand_id || brand.id || brand.uuid);

  return {
    id: brandId,
    name: text(brand.brand_name),
    businessUnitId: null,
    companyName: nullableText(brand.company_name),
    brandAddress: nullableText(brand.brand_address),
    clientCode: String(brand.client_code || ""),
    color: text(brand.color, randomColor(brandId)),
    logo: nullableText(brand.logo),
    website: nullableText(brand.brand_website),
    contactName: nullableText(brand.pic_brand_name),
    contactTitle: nullableText(brand.pic_title),
    contactEmail: nullableText(brand.pic_email),
    contactPhone: nullableText(brand.pic_brand_phone),
    picFinanceName: nullableText(brand.pic_finance_name),
    picFinancePhone: nullableText(brand.pic_finance_phone),
    industryCategory: nullableText(brand.industry_category),
    description: nullableText(brand.description),
    status: brand.flag === "active" ? "active" : brand.flag === "inactive" ? "inactive" : "prospect",
    createdAt: text(brand.created_at),
    updatedAt: text(brand.updated_at),
  };
}

function transformDepartment(dept: ApiRecord): Department {
  const id = String(dept.id);

  return {
    id,
    businessUnitId: dept.business_unit_id ? String(dept.business_unit_id) : null,
    name: text(dept.department_name),
    code: text(dept.code),
    color: text(dept.color, randomColor(id)),
    description: nullableText(dept.description),
    isActive: dept.is_active !== false,
    createdAt: text(dept.created_at),
    updatedAt: text(dept.updated_at),
  };
}

function transformProject(project: ApiRecord, projectType: "campaign" | "pitch"): Project {
  const id = text(project.uuid);
  const brandId =
    project.brand_id !== null && project.brand_id !== undefined ? String(project.brand_id) : null;
  const brand = asRecord(project.brand);

  if (projectType === "pitch") {
    return {
      id,
      projectNumber: nullableText(project.pitch_number),
      name: text(project.pitch_name),
      brandId: brandId ?? "",
      businessUnitId: null,
      projectCategoryId: null,
      projectTypeId: null,
      projectType,
      entity: null,
      description: null,
      color: randomColor(id),
      budget: nullableText(project.budget),
      asf: null,
      grandTotal: nullableText(project.value_total),
      currency: text(project.currency),
      ioFile: null,
      flag: null,
      quotationReference: null,
      startDate: null,
      endDate: null,
      status: project.status === "win" ? "completed" : project.status === "loss" ? "cancelled" : "planning",
      createdById: nullableText(asRecord(project.author).uuid),
      notes: nullableText(project.notes),
      region: nullableText(project.region),
      submitDate: nullableText(project.date_submit),
      pitchStatus:
        project.status === "on_going"
          ? "proposal_development"
          : project.status === "win"
            ? "won"
            : project.status === "loss"
              ? "lost"
              : null,
      valueTotalEstimate: project.value_total ? String(project.value_total) : null,
      hsDealId: null,
      createdAt: text(project.created_at),
      updatedAt: text(project.updated_at),
      brand: Object.keys(brand).length
        ? {
            id: brandId ?? "",
            name: text(brand.brand_name),
            color: randomColor(brandId ?? id),
          }
        : undefined,
    };
  }

  return {
    id,
    projectNumber: nullableText(project.io_number),
    name: text(project.campaign_name),
    brandId: brandId ?? "",
    businessUnitId: null,
    projectCategoryId: null,
    projectTypeId: null,
    projectType,
    entity: null,
    description: null,
    color: randomColor(id),
    budget: nullableText(project.budget),
    asf: nullableText(project.asf),
    grandTotal: nullableText(project.grand_total),
    currency: text(project.currency),
    ioFile: nullableText(project.io_file),
    flag: nullableText(project.flag),
    quotationReference: nullableText(project.quotation_reference),
    startDate: nullableText(project.start_date),
    endDate: nullableText(project.end_date),
    status: project.flag === "active" ? "active" : project.flag === "inactive" ? "completed" : "planning",
    createdById: null,
    notes: nullableText(project.notes),
    region: null,
    submitDate: null,
    pitchStatus: null,
    valueTotalEstimate: null,
    hsDealId: null,
    createdAt: text(project.created_at),
    updatedAt: text(project.updated_at),
    brand: Object.keys(brand).length
      ? {
          id: brandId ?? "",
          name: text(brand.brand_name),
          color: randomColor(brandId ?? id),
        }
      : undefined,
  };
}

function transformAssignment(mysqlAssignment: ApiRecord): Assignment {
  return {
    id: text(mysqlAssignment.uuid),
    employeeId: text(mysqlAssignment.employee_uuid),
    projectId: nullableText(mysqlAssignment.project_uuid),
    taskId: nullableText(mysqlAssignment.task_uuid),
    startDate: dateValue(mysqlAssignment.start_date),
    endDate: dateValue(mysqlAssignment.end_date),
    hoursPerDay: stringValue(mysqlAssignment.hours_per_day),
    totalHours:
      mysqlAssignment.total_hours === null || mysqlAssignment.total_hours === undefined
        ? null
        : numberValue(mysqlAssignment.total_hours),
    allocationPercentage:
      mysqlAssignment.allocation_percentage === null || mysqlAssignment.allocation_percentage === undefined
        ? null
        : stringValue(mysqlAssignment.allocation_percentage),
    isTimeOff: booleanValue(mysqlAssignment.is_time_off),
    timeOffTypeId: nullableText(mysqlAssignment.time_off_type_uuid),
    category: nullableText(mysqlAssignment.category),
    isBillable: booleanValue(mysqlAssignment.is_billable),
    isAdjustment: booleanValue(mysqlAssignment.is_adjustment),
    status:
      mysqlAssignment.status === "draft" ||
      mysqlAssignment.status === "confirmed" ||
      mysqlAssignment.status === "completed"
        ? mysqlAssignment.status
        : "confirmed",
    note: nullableText(mysqlAssignment.note),
    createdById: nullableText(mysqlAssignment.created_by_uuid),
    createdAt: text(mysqlAssignment.created_at),
    updatedAt: text(mysqlAssignment.updated_at),
  };
}

function transformActual(mysqlActual: ApiRecord): ActualAssignment {
  return {
    uuid: text(mysqlActual.uuid),
    employeeUuid: text(mysqlActual.employee_uuid),
    projectUuid: nullableText(mysqlActual.project_uuid),
    taskUuid: nullableText(mysqlActual.task_uuid),
    startDate: dateValue(mysqlActual.start_date),
    endDate: dateValue(mysqlActual.end_date),
    hoursPerDay: numberValue(mysqlActual.hours_per_day),
    allocationPercentage:
      mysqlActual.allocation_percentage === null || mysqlActual.allocation_percentage === undefined
        ? null
        : numberValue(mysqlActual.allocation_percentage),
    isTimeOff: booleanValue(mysqlActual.is_time_off),
    timeOffTypeUuid: nullableText(mysqlActual.time_off_type_uuid),
    category: nullableText(mysqlActual.category),
    isBillable: booleanValue(mysqlActual.is_billable),
    status: text(mysqlActual.status),
    note: nullableText(mysqlActual.note),
    createdByUuid: nullableText(mysqlActual.created_by_uuid),
    createdAt: text(mysqlActual.created_at),
    updatedAt: text(mysqlActual.updated_at),
  };
}

export async function fetchInitialEmployeePage(session: SessionData) {
  const client = getMySqlApiClient(async () => session.access_token);
  const firstResponse = await client.getEmployees({
    page: 1,
    per_page: 100,
  });
  assertApiSuccess(firstResponse, "employees");
  const meta = getApiMeta(firstResponse);
  const lastPage = numberValue(meta.last_page, 1);
  const remainingResponses = await Promise.all(
    Array.from({ length: Math.max(0, lastPage - 1) }, (_, index) =>
      client.getEmployees({
        page: index + 2,
        per_page: 100,
      })
    )
  );
  const data = sortEmployeeRecordsByName([
    ...getApiData(firstResponse),
    ...remainingResponses.flatMap((response) => getApiData(response)),
  ]).slice(0, INITIAL_EMPLOYEE_PAGE_SIZE);
  const total = numberValue(meta.total, data.length);

  return {
    data: data.map(transformEmployee),
    total: session.access.can_view_all ? total : data.length,
    hasMore: session.access.can_view_all ? INITIAL_EMPLOYEE_PAGE_SIZE < total : false,
  };
}

export async function fetchPlannerBrands(session: SessionData): Promise<Brand[]> {
  const client = getMySqlApiClient(async () => session.access_token);
  const response = await client.getBrands({ page: 1, per_page: 1000, include: "all" });
  assertApiSuccess(response, "brands");
  return getApiData(response).map(transformBrand);
}

export async function fetchPlannerDepartments(session: SessionData): Promise<Department[]> {
  const client = getMySqlApiClient(async () => session.access_token);
  const response = await client.getDepartments({ page: 1, per_page: 1000 });
  assertApiSuccess(response, "departments");
  return getApiData(response).map(transformDepartment);
}

export async function fetchPlannerProjects(session: SessionData): Promise<Project[]> {
  const client = getMySqlApiClient(async () => session.access_token);
  const [campaignsResponse, pitchesResponse] = await Promise.all([
    client.getCampaigns({ page: 1, per_page: 50, include: "channels" }),
    client.getPitches({ page: 1, per_page: 50, include: "channels" }),
  ]);
  assertApiSuccess(campaignsResponse, "campaigns");
  assertApiSuccess(pitchesResponse, "pitches");

  return [
    ...getApiData(campaignsResponse).map((campaign) => transformProject(campaign, "campaign")),
    ...getApiData(pitchesResponse).map((pitch) => transformProject(pitch, "pitch")),
  ];
}

export async function fetchPlannerAssignments(
  session: SessionData,
  dateRange: { startDate: string; endDate: string }
): Promise<Assignment[]> {
  const employeeUuid = !session.access.can_view_all ? session.employee?.uuid : undefined;
  const assignments = (await getAssignments({
    employee_uuid: employeeUuid,
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
  })) as ApiRecord[];

  return assignments.map(transformAssignment);
}

export async function fetchPlannerActualAssignments(
  session: SessionData,
  dateRange: { startDate: string; endDate: string }
): Promise<ActualAssignment[]> {
  const employeeUuid = !session.access.can_view_all ? session.employee?.uuid : undefined;
  const actuals = (await getActualAssignments({
    employee_uuid: employeeUuid,
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
  })) as ApiRecord[];

  return actuals.map(transformActual);
}

function filterPlannerAssignments(
  assignments: Assignment[],
  request: PlannerTimelineRequest
): Assignment[] {
  return assignments.filter((assignment) => {
    if (request.filters?.projectId && assignment.projectId !== request.filters.projectId) {
      return false;
    }
    if (request.filters?.category && assignment.category !== request.filters.category) {
      return false;
    }
    if (request.filters?.status && assignment.status !== request.filters.status) {
      return false;
    }
    return true;
  });
}

function filterPlannerActualAssignments(
  actualAssignments: ActualAssignment[],
  request: PlannerTimelineRequest
): ActualAssignment[] {
  return actualAssignments.filter((assignment) => {
    if (request.filters?.projectId && assignment.projectUuid !== request.filters.projectId) {
      return false;
    }
    if (request.filters?.category && assignment.category !== request.filters.category) {
      return false;
    }
    if (request.filters?.status && assignment.status !== request.filters.status) {
      return false;
    }
    return true;
  });
}

export async function fetchPlannerTimeline(
  session: SessionData,
  request: PlannerTimelineRequest
): Promise<PlannerTimelineResponse> {
  const dateRange = {
    startDate: request.startDate,
    endDate: request.endDate,
  };
  const [assignments, actualAssignments] = await Promise.all([
    fetchPlannerAssignments(session, dateRange),
    fetchPlannerActualAssignments(session, dateRange),
  ]);
  const filteredAssignments = filterPlannerAssignments(assignments, request);
  const filteredActualAssignments = filterPlannerActualAssignments(actualAssignments, request);

  if (request.resolution === "month") {
    return {
      request,
      assignments: summarizeMonthlyAssignments(filteredAssignments, dateRange),
      actualAssignments: summarizeMonthlyActualAssignments(filteredActualAssignments, dateRange),
    };
  }

  return {
    request,
    assignments: filteredAssignments,
    actualAssignments: filteredActualAssignments,
  };
}
