import type { Project, ProjectOption } from "@/lib/query/hooks/useProjects";

type ProjectStatus = Project["status"];
type PitchStatus = Project["pitchStatus"];

type BrandRecord = {
  brand_name?: unknown;
};

type AuthorRecord = {
  uuid?: string | null;
};

export type ProjectApiResponse = Omit<Project, "brandId"> & {
  brandId: string | null;
  companyId: string | null;
  state?: string | null;
  company?: unknown;
  channels?: unknown;
};

export type CampaignApiRecord = {
  uuid?: unknown;
  io_number?: unknown;
  campaign_name?: unknown;
  brand_id?: unknown;
  company_id?: unknown;
  currency?: unknown;
  budget?: unknown;
  asf?: unknown;
  grand_total?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  notes?: unknown;
  io_file?: unknown;
  state?: unknown;
  flag?: unknown;
  quotation_reference?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  brand?: BrandRecord | null;
  company?: unknown;
  channels?: unknown;
};

export type PitchApiRecord = {
  uuid?: unknown;
  pitch_number?: unknown;
  pitch_name?: unknown;
  brand_id?: unknown;
  currency?: unknown;
  budget?: unknown;
  value_total?: unknown;
  notes?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  author?: AuthorRecord | null;
  region?: unknown;
  date_submit?: unknown;
  brand?: BrandRecord | null;
  channels?: unknown;
};

const PROJECT_COLOR_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#ef4444",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
] as const;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function projectColor(seed: unknown): string {
  const seedText = text(seed);
  if (!seedText) return PROJECT_COLOR_PALETTE[0];

  let hash = 0;
  for (let index = 0; index < seedText.length; index += 1) {
    hash = (hash * 31 + seedText.charCodeAt(index)) >>> 0;
  }

  return PROJECT_COLOR_PALETTE[hash % PROJECT_COLOR_PALETTE.length];
}

function campaignStatus(flag: unknown): ProjectStatus {
  if (flag === "active") return "active";
  if (flag === "inactive") return "completed";
  return "planning";
}

function pitchProjectStatus(status: unknown): ProjectStatus {
  if (status === "win") return "completed";
  if (status === "loss") return "cancelled";
  return "planning";
}

function pitchStatus(status: unknown): PitchStatus {
  if (status === "on_going") return "proposal_development";
  if (status === "win") return "won";
  if (status === "loss") return "lost";
  return null;
}

export function mapCampaignToProject(campaign: CampaignApiRecord): ProjectApiResponse {
  const brandId = nullableText(campaign.brand_id);

  return {
    id: text(campaign.uuid),
    projectNumber: nullableText(campaign.io_number),
    name: text(campaign.campaign_name),
    brandId,
    companyId: nullableText(campaign.company_id),
    currency: text(campaign.currency),
    budget: nullableText(campaign.budget),
    asf: nullableText(campaign.asf),
    grandTotal: nullableText(campaign.grand_total),
    startDate: nullableText(campaign.start_date),
    endDate: nullableText(campaign.end_date),
    notes: nullableText(campaign.notes),
    ioFile: nullableText(campaign.io_file),
    flag: nullableText(campaign.flag),
    state: nullableText(campaign.state),
    status: campaignStatus(campaign.flag),
    quotationReference: nullableText(campaign.quotation_reference),
    createdAt: text(campaign.created_at),
    updatedAt: text(campaign.updated_at),
    businessUnitId: null,
    projectCategoryId: null,
    projectTypeId: null,
    projectType: "campaign",
    entity: null,
    description: null,
    color: projectColor(campaign.uuid ?? campaign.io_number ?? campaign.campaign_name),
    createdById: null,
    region: null,
    submitDate: null,
    pitchStatus: null,
    valueTotalEstimate: null,
    hsDealId: null,
    brand: campaign.brand && brandId
      ? {
          id: brandId,
          name: text(campaign.brand.brand_name),
          color: projectColor(`brand:${brandId}`),
        }
      : undefined,
    company: campaign.company,
    channels: campaign.channels,
  };
}

export function mapPitchToProject(pitch: PitchApiRecord): ProjectApiResponse {
  const brandId = nullableText(pitch.brand_id);

  return {
    id: text(pitch.uuid),
    projectNumber: nullableText(pitch.pitch_number),
    name: text(pitch.pitch_name),
    brandId,
    companyId: null,
    currency: text(pitch.currency),
    budget: nullableText(pitch.budget),
    asf: null,
    grandTotal: nullableText(pitch.value_total),
    startDate: null,
    endDate: null,
    notes: nullableText(pitch.notes),
    ioFile: null,
    flag: null,
    state: null,
    status: pitchProjectStatus(pitch.status),
    quotationReference: null,
    createdAt: text(pitch.created_at),
    updatedAt: text(pitch.updated_at),
    businessUnitId: null,
    projectCategoryId: null,
    projectTypeId: null,
    projectType: "pitch",
    entity: null,
    description: null,
    color: projectColor(pitch.uuid ?? pitch.pitch_number ?? pitch.pitch_name),
    createdById: pitch.author?.uuid ?? null,
    region: nullableText(pitch.region),
    submitDate: nullableText(pitch.date_submit),
    pitchStatus: pitchStatus(pitch.status),
    valueTotalEstimate: nullableText(pitch.value_total),
    hsDealId: null,
    brand: pitch.brand && brandId
      ? {
          id: brandId,
          name: text(pitch.brand.brand_name),
          color: projectColor(`brand:${brandId}`),
        }
      : undefined,
    company: null,
    channels: pitch.channels,
  };
}

export function mapCampaignToProjectSummary(campaign: CampaignApiRecord): ProjectOption {
  return {
    id: text(campaign.uuid),
    name: text(campaign.campaign_name),
    brandId: nullableText(campaign.brand_id),
    color: projectColor(campaign.uuid ?? campaign.io_number ?? campaign.campaign_name),
    status: campaignStatus(campaign.flag),
    projectType: "campaign",
    startDate: nullableText(campaign.start_date),
    endDate: nullableText(campaign.end_date),
  };
}

export function mapPitchToProjectSummary(pitch: PitchApiRecord): ProjectOption {
  return {
    id: text(pitch.uuid),
    name: text(pitch.pitch_name),
    brandId: nullableText(pitch.brand_id),
    color: projectColor(pitch.uuid ?? pitch.pitch_number ?? pitch.pitch_name),
    status: pitchProjectStatus(pitch.status),
    projectType: "pitch",
    startDate: null,
    endDate: null,
  };
}
