import { describe, expect, it } from "vitest";
import { determineAccessLevel } from "@/lib/auth/access-level";

describe("determineAccessLevel", () => {
  it("grants full access to an allowlisted NIK regardless of department", () => {
    expect(
      determineAccessLevel({ nik: "L-386", dept_id: 999, position: "Intern" })
    ).toBe("full");
  });

  it("normalizes NIK casing and whitespace when matching the allowlist", () => {
    expect(determineAccessLevel({ nik: "  l-096 ", dept_id: 999 })).toBe("full");
  });

  it("grants full access to every full-access department", () => {
    for (const deptId of [1, 2, 4, 5, 10]) {
      expect(
        determineAccessLevel({ dept_id: deptId, position: "Anything" })
      ).toBe("full");
    }
  });

  it("grants full access to Creative (7) for Project Manager (any casing)", () => {
    expect(
      determineAccessLevel({ dept_id: 7, position: "Project Manager" })
    ).toBe("full");
    expect(
      determineAccessLevel({ dept_id: 7, position: " project manager " })
    ).toBe("full");
  });

  it("restricts Creative (7) for non-Project-Manager positions", () => {
    expect(
      determineAccessLevel({ dept_id: 7, position: "Designer" })
    ).toBe("restricted");
  });

  it("restricts other departments by default", () => {
    expect(
      determineAccessLevel({ dept_id: 3, position: "Manager" })
    ).toBe("restricted");
  });

  it("restricts when dept_id and nik are both missing", () => {
    expect(determineAccessLevel({})).toBe("restricted");
  });

  it("ignores an unknown NIK and falls through to department rules", () => {
    expect(determineAccessLevel({ nik: "L-999", dept_id: 3 })).toBe("restricted");
    expect(determineAccessLevel({ nik: "L-999", dept_id: 1 })).toBe("full");
  });
});
