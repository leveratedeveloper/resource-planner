import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/employees/route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetchOrderedEmployeeSlice: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/employees/ordered-directory", () => ({
  fetchOrderedEmployeeSlice: mocks.fetchOrderedEmployeeSlice,
}));

describe("employees route loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      access_token: "token",
      user: { id: 1, email: "full@example.com" },
      employee: { id: 1, uuid: "employee-a", full_name: "Alpha Person" },
      access: {
        level: "full",
        can_view_all: true,
        can_view_own_only: false,
      },
    });
  });

  it("delegates pagination and search to the local ordered employee directory", async () => {
    mocks.fetchOrderedEmployeeSlice.mockResolvedValue({
      data: [{ id: "employee-a", fullName: "Alpha Person" }],
      total: 37,
      hasMore: true,
      cacheStatus: "miss",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/employees?limit=24&offset=24&search=alpha")
    );
    const body = await response.json();

    expect(mocks.fetchOrderedEmployeeSlice).toHaveBeenCalledWith(
      expect.objectContaining({ access: expect.objectContaining({ can_view_all: true }) }),
      {
        offset: 24,
        limit: 24,
        search: "alpha",
      }
    );
    expect(body).toMatchObject({
      success: true,
      total: 37,
      hasMore: true,
      data: [{ id: "employee-a", fullName: "Alpha Person" }],
    });
  });

  it("uses safe default pagination when query params are missing", async () => {
    mocks.fetchOrderedEmployeeSlice.mockResolvedValue({
      data: [],
      total: 0,
      hasMore: false,
      cacheStatus: "miss",
    });

    await GET(new Request("http://localhost:3000/api/employees"));

    expect(mocks.fetchOrderedEmployeeSlice).toHaveBeenCalledWith(
      expect.anything(),
      {
        offset: 0,
        limit: 50,
        search: undefined,
      }
    );
  });
});
