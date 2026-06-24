import { describe, expect, it } from "vitest";
import {
  mapCampaignToProject,
  mapCampaignToProjectSummary,
  mapPitchToProject,
  mapPitchToProjectSummary,
  projectColor,
} from "@/lib/projects/project-mappers";

describe("project mappers", () => {
  const campaign = {
    uuid: "campaign-1",
    io_number: "IO-1",
    campaign_name: "Launch Campaign",
    brand_id: 10,
    company_id: 20,
    currency: "USD",
    budget: "1000",
    asf: "100",
    grand_total: "1100",
    start_date: "2026-05-01",
    end_date: "2026-05-31",
    notes: "Campaign note",
    io_file: null,
    state: "publish",
    flag: "active",
    quotation_reference: "Q-1",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-02T00:00:00Z",
    brand: { brand_name: "Brand A" },
    company: { company_name: "Company A" },
    channels: [{ id: "channel-1" }],
  };

  const pitch = {
    uuid: "pitch-1",
    pitch_number: "P-1",
    pitch_name: "Pitch Work",
    brand_id: null,
    currency: "IDR",
    budget: "2000",
    value_total: "2500",
    notes: "Pitch note",
    status: "win",
    created_at: "2026-05-03T00:00:00Z",
    updated_at: "2026-05-04T00:00:00Z",
    author: { uuid: "user-1" },
    region: "APAC",
    date_submit: "2026-05-10",
    brand: null,
    channels: [{ id: "channel-2" }],
  };

  it("maps a campaign to the full project shape", () => {
    const project = mapCampaignToProject(campaign);

    expect(project).toMatchObject({
      id: "campaign-1",
      projectNumber: "IO-1",
      name: "Launch Campaign",
      brandId: "10",
      companyId: "20",
      status: "active",
      projectType: "campaign",
      pitchStatus: null,
      channels: [{ id: "channel-1" }],
    });
  });

  it("maps a campaign summary without heavy fields", () => {
    const summary = mapCampaignToProjectSummary(campaign);

    expect(summary).toEqual({
      id: "campaign-1",
      projectKey: "campaign:campaign-1",
      name: "Launch Campaign",
      brandId: "10",
      color: expect.any(String),
      status: "active",
      projectType: "campaign",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
    expect(summary).not.toHaveProperty("channels");
  });

  it("maps a pitch to the full project shape", () => {
    const project = mapPitchToProject(pitch);

    expect(project).toMatchObject({
      id: "pitch-1",
      projectNumber: "P-1",
      name: "Pitch Work",
      brandId: null,
      status: "completed",
      projectType: "pitch",
      pitchStatus: "won",
      createdById: "user-1",
      channels: [{ id: "channel-2" }],
    });
  });

  it("maps a pitch summary without heavy fields", () => {
    const summary = mapPitchToProjectSummary(pitch);

    expect(summary).toEqual({
      id: "pitch-1",
      projectKey: "pitch:pitch-1",
      name: "Pitch Work",
      brandId: null,
      color: expect.any(String),
      status: "completed",
      projectType: "pitch",
      startDate: null,
      endDate: null,
    });
    expect(summary).not.toHaveProperty("channels");
  });

  it("returns stable project colors for the same campaign seed", () => {
    const first = mapCampaignToProject(campaign);
    const second = mapCampaignToProject(campaign);
    expect(first.color).toBe(second.color);
    expect(first.brand?.color).toBe(second.brand?.color);
  });

  it("returns different colors for different campaign ids", () => {
    const first = projectColor("campaign-1");
    const second = projectColor("campaign-2");
    expect(first).not.toBe(second);
  });
});
