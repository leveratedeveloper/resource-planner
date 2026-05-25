import { describe, expect, it, vi } from "vitest";
import {
  createEmployeeDirectoryCache,
  type EmployeeDirectoryPage,
} from "@/lib/employees/directory-cache";

type EmployeeRecord = {
  uuid: string;
  full_name: string;
};

function page(
  data: EmployeeRecord[],
  currentPage: number,
  lastPage: number
): EmployeeDirectoryPage<EmployeeRecord> {
  return {
    data,
    meta: {
      currentPage,
      lastPage,
      total: data.length,
    },
  };
}

describe("employee directory cache", () => {
  it("serves globally sorted paginated slices after building the directory", async () => {
    const fetchPage = vi.fn(async (pageNumber: number) =>
      pageNumber === 1
        ? page(
            [
              { uuid: "employee-c", full_name: "Charlie Person" },
              { uuid: "employee-a", full_name: "alpha Person" },
            ],
            1,
            2
          )
        : page([{ uuid: "employee-b", full_name: "Beta Person" }], 2, 2)
    );
    const cache = createEmployeeDirectoryCache<EmployeeRecord>({
      fetchPage,
      sortRecords: (employees) =>
        [...employees].sort((a, b) =>
          a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" })
        ),
      ttlMs: 60_000,
    });

    await expect(cache.getSlice("all", { offset: 0, limit: 2 })).resolves.toEqual({
      data: [
        { uuid: "employee-a", full_name: "alpha Person" },
        { uuid: "employee-b", full_name: "Beta Person" },
      ],
      total: 3,
      hasMore: true,
      cacheStatus: "miss",
    });
    await expect(cache.getSlice("all", { offset: 2, limit: 2 })).resolves.toEqual({
      data: [{ uuid: "employee-c", full_name: "Charlie Person" }],
      total: 3,
      hasMore: false,
      cacheStatus: "hit",
    });
  });

  it("deduplicates concurrent directory builds for the same search scope", async () => {
    let releaseFirstPage: ((value: EmployeeDirectoryPage<EmployeeRecord>) => void) | undefined;
    const firstPage = new Promise<EmployeeDirectoryPage<EmployeeRecord>>((resolve) => {
      releaseFirstPage = resolve;
    });
    const fetchPage = vi.fn(async () => firstPage);
    const cache = createEmployeeDirectoryCache<EmployeeRecord>({
      fetchPage,
      sortRecords: (employees) => employees,
      ttlMs: 60_000,
    });

    const firstSlice = cache.getSlice("search:alex", { offset: 0, limit: 12 });
    const secondSlice = cache.getSlice("search:alex", { offset: 12, limit: 12 });

    releaseFirstPage?.(page([{ uuid: "employee-a", full_name: "Alex Person" }], 1, 1));

    await Promise.all([firstSlice, secondSlice]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
