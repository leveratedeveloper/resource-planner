import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import type { MySqlQueryParams } from "@/lib/types/mysql";
import {
  mapCampaignToProjectSummary,
  mapPitchToProjectSummary,
  type CampaignApiRecord,
  type PitchApiRecord,
} from "@/lib/projects/project-mappers";

type ProjectSummaryClient = {
  getCampaigns: (params?: MySqlQueryParams) => Promise<unknown>;
  getPitches: (params?: MySqlQueryParams) => Promise<unknown>;
};

type ApiMeta = {
  current_page?: number;
  last_page?: number;
  total?: number;
};

type ApiResponseShape = {
  error?: {
    message?: string;
  };
  data?: unknown;
  meta?: ApiMeta;
};

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 200;

type ProjectSummarySourceResult = {
  data: ProjectOption[];
  hasMore: boolean;
  truncated: boolean;
};

export type ProjectSummaryResult = {
  data: ProjectOption[];
  hasMore: boolean;
  truncated: boolean;
};

function asObject(response: unknown): ApiResponseShape {
  return response && typeof response === "object" ? (response as ApiResponseShape) : {};
}

function recordsFromResponse(response: unknown): unknown[] {
  const object = asObject(response);
  if (Array.isArray(object.data)) return object.data;

  const nested = object.data;
  if (nested && typeof nested === "object" && Array.isArray((nested as { data?: unknown }).data)) {
    return (nested as { data: unknown[] }).data;
  }

  return [];
}

function metaFromResponse(response: unknown): ApiMeta | undefined {
  const object = asObject(response);
  if (object.meta) return object.meta;

  const nested = object.data;
  if (nested && typeof nested === "object") {
    return (nested as { meta?: ApiMeta }).meta;
  }

  return undefined;
}

async function fetchProjectSummariesForType<TRecord>({
  fetchPage,
  mapRecord,
  maxPages,
}: {
  fetchPage: (page: number) => Promise<unknown>;
  mapRecord: (record: TRecord) => ProjectOption;
  maxPages: number;
}): Promise<ProjectSummarySourceResult> {
  const projects: ProjectOption[] = [];
  let hasMore = false;
  let truncated = false;

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchPage(page);
    const object = asObject(response);
    if (object.error) {
      throw new Error(object.error.message || "Failed to fetch project summaries");
    }

    const records = recordsFromResponse(response) as TRecord[];
    projects.push(...records.map(mapRecord));

    const meta = metaFromResponse(response);
    hasMore = Boolean(meta?.last_page && page < meta.last_page);

    if (records.length === 0 || !hasMore) {
      break;
    }

    if (page === maxPages) {
      truncated = true;
    }
  }

  return { data: projects, hasMore, truncated };
}

export async function fetchProjectSummaries({
  client,
  brandId,
  search,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPagesPerSource = DEFAULT_MAX_PAGES,
}: {
  client: ProjectSummaryClient;
  brandId?: string;
  search?: string;
  pageSize?: number;
  maxPagesPerSource?: number;
}): Promise<ProjectSummaryResult> {
  const [campaigns, pitches] = await Promise.all([
    fetchProjectSummariesForType<CampaignApiRecord>({
      fetchPage: (page) =>
        client.getCampaigns({
          page,
          per_page: pageSize,
          brand_id: brandId,
          search,
        }),
      mapRecord: mapCampaignToProjectSummary,
      maxPages: maxPagesPerSource,
    }),
    fetchProjectSummariesForType<PitchApiRecord>({
      fetchPage: (page) =>
        client.getPitches({
          page,
          per_page: pageSize,
          brand_id: brandId,
          search,
        }),
      mapRecord: mapPitchToProjectSummary,
      maxPages: maxPagesPerSource,
    }),
  ]);

  return {
    data: [...campaigns.data, ...pitches.data],
    hasMore: campaigns.hasMore || pitches.hasMore,
    truncated: campaigns.truncated || pitches.truncated,
  };
}
