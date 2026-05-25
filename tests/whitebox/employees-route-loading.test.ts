import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/employees/route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getMySqlApiClient: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/mysql/api-client", () => ({
  getMySqlApiClient: mocks.getMySqlApiClient,
}));

describe("employees route loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only the signed-in employee for restricted access", async () => {
    const getEmployee = vi.fn().mockResolvedValue({
      success: true,
      data: {
        uuid: "employee-1",
        nik: "NIK-1",
        full_name: "Restricted Person",
        position: "Consultant",
        dept_id: 12,
        flag: "active",
        status: "visible",
      },
    });
    const getEmployees = vi.fn();

    mocks.getSession.mockResolvedValue({
      access_token: "token",
      user: { id: 1, email: "restricted@example.com" },
      employee: {
        id: 1,
        uuid: "employee-1",
        nik: "NIK-1",
        full_name: "Restricted Person",
        nickname: "Restricted",
        position: "Consultant",
        dept_id: 12,
        department_name: "Consulting",
        photo: "",
      },
      access: {
        level: "restricted",
        can_view_all: false,
        can_view_own_only: true,
      },
    });
    mocks.getMySqlApiClient.mockReturnValue({ getEmployee, getEmployees });

    const response = await GET(new Request("http://localhost:3000/api/employees?limit=12&offset=0"));
    const body = await response.json();

    expect(getEmployee).toHaveBeenCalledWith("employee-1");
    expect(getEmployees).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      success: true,
      total: 1,
      hasMore: false,
      data: [{ id: "employee-1", fullName: "Restricted Person" }],
    });
  });

  it("reuses a pending canonical ordered employee directory build across API loading", async () => {
    let releaseEmployees:
      | ((value: {
          success: true;
          data: {
            data: Array<{ uuid: string; full_name: string }>;
            meta: { current_page: number; last_page: number; total: number };
          };
        }) => void)
      | undefined;
    const firstPage = new Promise<{
      success: true;
      data: {
        data: Array<{ uuid: string; full_name: string }>;
        meta: { current_page: number; last_page: number; total: number };
      };
    }>((resolve) => {
      releaseEmployees = resolve;
    });
    const getEmployees = vi.fn(async () => firstPage);
    const session = {
      access_token: "token",
      user: { id: 1, email: "full@example.com" },
      employee: {
        id: 1,
        uuid: "employee-a",
        nik: "NIK-A",
        full_name: "Alpha Person",
        nickname: "Alpha",
        position: "Consultant",
        dept_id: 12,
        department_name: "Consulting",
        photo: "",
      },
      access: {
        level: "full" as const,
        can_view_all: true,
        can_view_own_only: false,
      },
    };

    mocks.getSession.mockResolvedValue(session);
    mocks.getMySqlApiClient.mockReturnValue({
      getEmployees,
      getEmployee: vi.fn(),
    });

    const firstApi = GET(new Request("http://localhost:3000/api/employees?limit=12&offset=0"));
    const secondApi = GET(new Request("http://localhost:3000/api/employees?limit=12&offset=0"));

    releaseEmployees?.({
      success: true,
      data: {
        data: [
          { uuid: "employee-b", full_name: "Beta Person" },
          { uuid: "employee-a", full_name: "alpha Person" },
        ],
        meta: {
          current_page: 1,
          last_page: 1,
          total: 2,
        },
      },
    });

    const [firstResponse, secondResponse] = await Promise.all([firstApi, secondApi]);
    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();

    expect(getEmployees).toHaveBeenCalledTimes(1);
    expect(firstBody.data.map((employee: { fullName: string }) => employee.fullName)).toEqual([
      "alpha Person",
      "Beta Person",
    ]);
    expect(secondBody.data.map((employee: { fullName: string }) => employee.fullName)).toEqual([
      "alpha Person",
      "Beta Person",
    ]);
  });

  it("does not keep full employee directories cached per search string", async () => {
    const getEmployees = vi.fn().mockResolvedValue({
      success: true,
      data: {
        data: [{ uuid: "employee-a", full_name: "Alex Person" }],
        meta: {
          current_page: 1,
          last_page: 1,
          total: 1,
        },
      },
    });

    mocks.getSession.mockResolvedValue({
      access_token: "token",
      user: { id: 1, email: "full@example.com" },
      employee: {
        id: 1,
        uuid: "employee-a",
        nik: "NIK-A",
        full_name: "Alex Person",
        nickname: "Alex",
        position: "Consultant",
        dept_id: 12,
        department_name: "Consulting",
        photo: "",
      },
      access: {
        level: "full",
        can_view_all: true,
        can_view_own_only: false,
      },
    });
    mocks.getMySqlApiClient.mockReturnValue({
      getEmployees,
      getEmployee: vi.fn(),
    });

    await GET(new Request("http://localhost:3000/api/employees?limit=12&offset=0&search=alex"));
    await GET(new Request("http://localhost:3000/api/employees?limit=12&offset=0&search=alex"));

    expect(getEmployees).toHaveBeenCalledTimes(2);
  });
});
