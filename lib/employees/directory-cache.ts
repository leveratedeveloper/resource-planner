export type EmployeeDirectoryPage<T> = {
  data: T[];
  meta: {
    currentPage: number;
    lastPage: number;
    total: number;
  };
};

type EmployeeDirectory<T> = {
  data: T[];
  expiresAt: number;
};

export type EmployeeDirectorySlice<T> = {
  data: T[];
  total: number;
  hasMore: boolean;
  cacheStatus: "hit" | "miss";
};

export function createEmployeeDirectoryCache<T>({
  fetchPage,
  sortRecords,
  ttlMs,
}: {
  fetchPage?: (page: number, scope: string) => Promise<EmployeeDirectoryPage<T>>;
  sortRecords: (records: T[]) => T[];
  ttlMs: number;
}) {
  const directories = new Map<string, EmployeeDirectory<T>>();
  const pendingDirectories = new Map<string, Promise<EmployeeDirectory<T>>>();

  async function buildDirectory(
    scope: string,
    loadPage: (page: number, scope: string) => Promise<EmployeeDirectoryPage<T>>,
    { cacheResult }: { cacheResult: boolean }
  ): Promise<EmployeeDirectory<T>> {
    const firstPage = await loadPage(1, scope);
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, firstPage.meta.lastPage - 1) }, (_, index) =>
        loadPage(index + 2, scope)
      )
    );
    const directory = {
      data: sortRecords([
        ...firstPage.data,
        ...remainingPages.flatMap((page) => page.data),
      ]),
      expiresAt: Date.now() + ttlMs,
    };

    if (cacheResult) {
      directories.set(scope, directory);
    }

    return directory;
  }

  async function getDirectory(
    scope: string,
    loadPage?: (page: number, scope: string) => Promise<EmployeeDirectoryPage<T>>
  ) {
    const existingDirectory = directories.get(scope);
    if (existingDirectory && existingDirectory.expiresAt > Date.now()) {
      return { directory: existingDirectory, cacheStatus: "hit" as const };
    }

    const directoryLoader = loadPage ?? fetchPage;
    if (!directoryLoader) {
      throw new Error("Employee directory cache requires a page loader on cache miss");
    }

    const pendingDirectory =
      pendingDirectories.get(scope) ??
      buildDirectory(scope, directoryLoader, { cacheResult: true }).finally(() => {
        pendingDirectories.delete(scope);
      });

    pendingDirectories.set(scope, pendingDirectory);

    return {
      directory: await pendingDirectory,
      cacheStatus: "miss" as const,
    };
  }

  return {
    async getSlice(
      scope: string,
      { offset, limit }: { offset: number; limit: number },
      loadPage?: (page: number, scope: string) => Promise<EmployeeDirectoryPage<T>>
    ) {
      const { directory, cacheStatus } = await getDirectory(scope, loadPage);
      const data = directory.data.slice(offset, offset + limit);

      return {
        data,
        total: directory.data.length,
        hasMore: offset + limit < directory.data.length,
        cacheStatus,
      } satisfies EmployeeDirectorySlice<T>;
    },
    async getUncachedSlice(
      scope: string,
      { offset, limit }: { offset: number; limit: number },
      loadPage?: (page: number, scope: string) => Promise<EmployeeDirectoryPage<T>>
    ) {
      const directoryLoader = loadPage ?? fetchPage;
      if (!directoryLoader) {
        throw new Error("Employee directory cache requires a page loader for uncached slices");
      }

      const directory = await buildDirectory(scope, directoryLoader, { cacheResult: false });
      const data = directory.data.slice(offset, offset + limit);

      return {
        data,
        total: directory.data.length,
        hasMore: offset + limit < directory.data.length,
        cacheStatus: "miss",
      } satisfies EmployeeDirectorySlice<T>;
    },
  };
}
