import type { MySqlCampaign, MySqlPitch } from "@/lib/types/mysql";
import type { Project, ProjectChannel } from "@/lib/query/hooks/useProjects";

const DEFAULT_COLOR = "#64748b";

function numToString(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapCampaignStatus(campaign: MySqlCampaign): Project["status"] {
  if (campaign.flag === "active") return "active";
  if (campaign.flag === "inactive") return "completed";
  return "planning";
}

function mapPitchRegion(region: MySqlPitch["region"]): string | null {
  if (region === "ID") return "Indonesia";
  if (region === "SG") return "Singapore";
  return null;
}

function mapPitchStatus(status: MySqlPitch["status"]): Project["pitchStatus"] {
  if (status === "win") return "won";
  if (status === "loss") return "lost";
  if (status === "on_going") return "introduction";
  return null;
}

export function mapCampaignToProject(campaign: MySqlCampaign): Project {
  const color = emptyToNull((campaign as { color?: string | null }).color) ?? DEFAULT_COLOR;
  return {
    id: campaign.uuid,
    brandId: String(campaign.brand_id ?? ""),
    businessUnitId: numToString(campaign.company_id),
    projectCategoryId: null,
    projectTypeId: null,
    projectType: "campaign",
    entity: null,
    name: campaign.campaign_name || campaign.uuid,
    projectNumber: emptyToNull(campaign.io_number),
    description: null,
    color,
    budget: numToString(campaign.budget),
    asf: numToString(campaign.asf),
    grandTotal: numToString(campaign.grand_total),
    currency: campaign.currency || "IDR",
    ioFile: emptyToNull(campaign.io_file),
    flag: emptyToNull(campaign.flag),
    quotationReference: emptyToNull(campaign.quotation_reference),
    startDate: emptyToNull(campaign.start_date),
    endDate: emptyToNull(campaign.end_date),
    status: mapCampaignStatus(campaign),
    createdById: null,
    notes: emptyToNull(campaign.notes),
    region: null,
    submitDate: null,
    pitchStatus: null,
    valueTotalEstimate: null,
    hsDealId: null,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
    brand: campaign.brand
      ? { id: campaign.brand.uuid, name: campaign.brand.brand_name, color: DEFAULT_COLOR }
      : undefined,
    businessUnit: campaign.company
      ? { id: String(campaign.company.id), name: campaign.company.company_name, color: DEFAULT_COLOR }
      : undefined,
    projectCategory: undefined,
    createdBy: undefined,
    assignments: [],
    projectChannels: (campaign.channels ?? []).map((ch): ProjectChannel => ({
      id: String(ch.id),
      projectId: campaign.uuid,
      channelId: String(ch.id),
      deliverableId: null,
      quantity: null,
      channelBudget: null,
      manHours: null,
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
      channel: { id: String(ch.id), channelName: ch.channel_name },
    })),
  };
}

export function mapPitchToProject(pitch: MySqlPitch): Project {
  const color = emptyToNull((pitch as { color?: string | null }).color) ?? DEFAULT_COLOR;
  return {
    id: pitch.uuid,
    brandId: String(pitch.brand_id ?? ""),
    businessUnitId: null,
    projectCategoryId: null,
    projectTypeId: null,
    projectType: "pitch",
    entity: null,
    name: pitch.pitch_name || pitch.uuid,
    projectNumber: emptyToNull(pitch.pitch_number),
    description: null,
    color,
    budget: numToString(pitch.budget),
    asf: null,
    grandTotal: null,
    currency: pitch.currency || "IDR",
    ioFile: null,
    flag: null,
    quotationReference: null,
    startDate: null,
    endDate: null,
    status: "planning",
    createdById: null,
    notes: emptyToNull(pitch.notes),
    region: mapPitchRegion(pitch.region),
    submitDate: emptyToNull(pitch.date_submit),
    pitchStatus: mapPitchStatus(pitch.status),
    valueTotalEstimate: numToString(pitch.value_total),
    hsDealId: null,
    createdAt: pitch.created_at,
    updatedAt: pitch.updated_at,
    brand: pitch.brand
      ? { id: pitch.brand.uuid, name: pitch.brand.brand_name, color: DEFAULT_COLOR }
      : undefined,
    businessUnit: undefined,
    projectCategory: undefined,
    createdBy: undefined,
    assignments: [],
    projectChannels: (pitch.channels ?? []).map((ch): ProjectChannel => ({
      id: String(ch.id),
      projectId: pitch.uuid,
      channelId: ch.channel_id !== null && ch.channel_id !== undefined ? String(ch.channel_id) : "",
      deliverableId: ch.deliverable_id !== null && ch.deliverable_id !== undefined ? String(ch.deliverable_id) : null,
      quantity: null,
      channelBudget: null,
      manHours: null,
      createdAt: pitch.created_at,
      updatedAt: pitch.updated_at,
    })),
  };
}
