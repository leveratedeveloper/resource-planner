import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function requestFor(pathname: string, session?: unknown) {
  const request = new NextRequest(`http://localhost:3000${pathname}`);

  if (session) {
    request.cookies.set("session", JSON.stringify(session));
  }

  return request;
}

function responseLocation(response: Response) {
  return response.headers.get("location");
}

describe("dashboard middleware gate", () => {
  it("redirects unauthenticated dashboard visits to login", () => {
    const response = middleware(requestFor("/dashboard"));

    expect(response.status).toBe(307);
    expect(responseLocation(response)).toBe("http://localhost:3000/login");
  });

  it("allows admin sessions to visit dashboard", () => {
    const response = middleware(requestFor("/dashboard", { access: { level: "admin" } }));

    expect(response.status).toBe(200);
    expect(responseLocation(response)).toBeNull();
  });

  it("allows the explicit email override to visit dashboard", () => {
    const response = middleware(
      requestFor("/dashboard", { user: { email: "super@timetrack.id" }, access: { level: "restricted" } })
    );

    expect(response.status).toBe(200);
    expect(responseLocation(response)).toBeNull();
  });

  it("redirects full access non-admin sessions away from dashboard", () => {
    const response = middleware(
      requestFor("/dashboard", { user: { email: "full@example.com" }, access: { level: "full", can_view_all: true } })
    );

    expect(response.status).toBe(307);
    expect(responseLocation(response)).toBe("http://localhost:3000/");
  });

  it("redirects restricted non-admin sessions away from dashboard", () => {
    const response = middleware(
      requestFor("/dashboard", { user: { email: "restricted@example.com" }, access: { level: "restricted" } })
    );

    expect(response.status).toBe(307);
    expect(responseLocation(response)).toBe("http://localhost:3000/");
  });

  it("does not treat dashboard-prefixed sibling routes as dashboard routes", () => {
    const response = middleware(
      requestFor("/dashboard-old", { user: { email: "restricted@example.com" }, access: { level: "restricted" } })
    );

    expect(response.status).toBe(200);
    expect(responseLocation(response)).toBeNull();
  });
});
