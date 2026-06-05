import { describe, expect, it } from "vitest";
import {
  normalizeBrandSource,
  normalizeDepartmentSource,
  normalizeEmployeeSource,
  normalizeProjectSource,
} from "@/lib/planner-directory/timetrack-source";

describe("planner directory normalizers", () => {
  it("normalizes campaign and pitch records into distinct project keys", () => {
    expect(
      normalizeProjectSource(
        {
          uuid: "42",
          campaign_name: "Alpha",
          brand_id: 9,
          company_id: 1,
          currency: "IDR",
          budget: 100,
          asf: 0,
          grand_total: 100,
          start_date: "2026-01-01",
          end_date: "2026-02-01",
          notes: "",
          io_file: "",
          state: "active",
          flag: "active",
          quotation_reference: "",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
        "campaign"
      )?.projectKey
    ).toBe("campaign:42");

    expect(
      normalizeProjectSource(
        {
          uuid: "42",
          pitch_number: "P-1",
          pitch_name: "Beta",
          brand_id: 9,
          region: null,
          date_submit: null,
          status: "win",
          budget: 100,
          value_total: 100,
          currency: "IDR",
          notes: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
        "pitch"
      )?.projectKey
    ).toBe("pitch:42");
  });

  it("normalizes departments, brands, and employees", () => {
    expect(
      normalizeDepartmentSource({
        id: 7,
        department_name: "Creative",
        code: "CR",
        color: "#111111",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      })?.departmentId
    ).toBe("7");

    expect(
      normalizeBrandSource({
        id: 9,
        uuid: "brand-9",
        company_name: "Acme",
        client_code: "C9",
        brand_name: "Acme Brand",
        brand_address: "",
        pic_brand_name: "",
        pic_email: "",
        brand_website: "",
        pic_title: "",
        pic_brand_phone: "",
        pic_finance_name: "",
        pic_finance_phone: null,
        industry_category: "",
        description: "",
        logo: "",
        flag: "active",
        tax_account: "",
        top: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      })?.brandId
    ).toBe("9");

    expect(
      normalizeEmployeeSource({
        uuid: "emp-1",
        nik: "N-1",
        full_name: "Ada Lovelace",
        nickname: "Ada",
        position: "Planner",
        dept_id: 7,
        direct_supervisor: 1,
        gender: "FEMALE",
        group_timeoff_category: 0,
        work_start_date: "2026-01-01",
        dob: "1990-01-01",
        photo: "/photo.png",
        flag: "active",
        status: "visible",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      })?.employeeUuid
    ).toBe("emp-1");
  });

  it("normalizes brands from the real Timetrack payload shape", () => {
    expect(
      normalizeBrandSource({
        brand_id: 579,
        uuid: "d89fbfdf-7e32-4d02-865d-da53a9b05483",
        company_name: "PT Johnson & Johnson Indonesia",
        client_code: 1294,
        brand_name: "Neutrogena",
        brand_address: "K-LINK TOWER, Jakarta",
        pic_brand_name: "Margaretha Harjanti",
        pic_email: "mharja01@kenvue.com",
        brand_website: "-",
        pic_title: "Procurement",
        pic_brand_phone: "081311118457",
        pic_finance_name: "",
        pic_finance_phone: null,
        industry_category: "",
        description: "",
        logo: "",
        flag: "active",
        tax_account: "",
        top: null,
        created_at: "2026-06-05T00:00:00Z",
        updated_at: "2026-06-05T00:00:00Z",
      } as never)?.brandId
    ).toBe("579");
  });

  it("normalizes project statuses into the planner project enum", () => {
    expect(
      normalizeProjectSource(
        {
          uuid: "campaign-1",
          campaign_name: "Launch",
          brand_id: 9,
          company_id: 1,
          currency: "IDR",
          budget: 100,
          asf: 0,
          grand_total: 100,
          start_date: "2026-01-01",
          end_date: "2026-01-31",
          notes: "",
          io_file: "",
          state: "publish",
          flag: "active",
          quotation_reference: "",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
        "campaign"
      )?.status
    ).toBe("active");

    expect(
      normalizeProjectSource(
        {
          uuid: "pitch-1",
          pitch_number: "P-1",
          pitch_name: "Pitch Work",
          brand_id: 9,
          region: null,
          date_submit: null,
          status: "win",
          budget: 100,
          value_total: 100,
          currency: "IDR",
          notes: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
        "pitch"
      )?.status
    ).toBe("completed");
  });
});
