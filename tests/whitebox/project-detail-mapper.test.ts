import { describe, expect, it } from "vitest";
import {
  mapCampaignToProject,
  mapPitchToProject,
} from "@/lib/projects/project-detail-mapper";
import type { MySqlCampaign, MySqlPitch } from "@/lib/types/mysql";

const campaign: MySqlCampaign = {
  uuid: "c-1",
  io_number: "IO-2026-001",
  campaign_name: "ALO",
  brand_id: 9,
  company_id: 3,
  currency: "IDR",
  budget: 1500000,
  asf: 75000,
  grand_total: 1575000,
  start_date: "2026-04-01",
  end_date: "2026-04-30",
  notes: "Launch campaign",
  io_file: "https://files/io.pdf",
  state: "publish",
  flag: "active",
  quotation_reference: "Q-77",
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-15T00:00:00Z",
};

const pitch: MySqlPitch = {
  uuid: "p-1",
  pitch_number: "P-2026-009",
  pitch_name: "BRI Pitch Media",
  brand_id: 12,
  region: "SG",
  date_submit: "2026-05-10",
  status: "win",
  budget: 900000,
  value_total: 1200000,
  currency: "IDR",
  notes: "Strong fit",
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-20T00:00:00Z",
  channels: [{ id: 1, channel_id: 5, deliverable_id: 8 }],
};

describe("mapCampaignToProject", () => {
  it("maps financial and identity fields from a campaign", () => {
    const p = mapCampaignToProject(campaign);
    expect(p.id).toBe("c-1");
    expect(p.projectType).toBe("campaign");
    expect(p.projectNumber).toBe("IO-2026-001");
    expect(p.businessUnitId).toBe("3");
    expect(p.budget).toBe("1500000");
    expect(p.asf).toBe("75000");
    expect(p.grandTotal).toBe("1575000");
    expect(p.currency).toBe("IDR");
    expect(p.quotationReference).toBe("Q-77");
    expect(p.ioFile).toBe("https://files/io.pdf");
    expect(p.notes).toBe("Launch campaign");
    expect(p.status).toBe("active");
    expect(p.region).toBeNull();
    expect(p.pitchStatus).toBeNull();
  });
});

describe("mapPitchToProject", () => {
  it("maps financial fields and translates region/status codes", () => {
    const p = mapPitchToProject(pitch);
    expect(p.id).toBe("p-1");
    expect(p.projectType).toBe("pitch");
    expect(p.projectNumber).toBe("P-2026-009");
    expect(p.budget).toBe("900000");
    expect(p.valueTotalEstimate).toBe("1200000");
    expect(p.currency).toBe("IDR");
    expect(p.notes).toBe("Strong fit");
    expect(p.region).toBe("Singapore");
    expect(p.submitDate).toBe("2026-05-10");
    expect(p.pitchStatus).toBe("won");
    expect(p.projectChannels).toHaveLength(1);
    expect(p.projectChannels?.[0]).toMatchObject({
      channelId: "5",
      deliverableId: "8",
    });
  });

  it("maps on_going to introduction and leaves null region empty", () => {
    const p = mapPitchToProject({ ...pitch, status: "on_going", region: null });
    expect(p.pitchStatus).toBe("introduction");
    expect(p.region).toBeNull();
  });
});
