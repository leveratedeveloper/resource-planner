/**
 * Debug Export API
 * Untuk mengecek data yang tersedia untuk export
 */

import { NextRequest, NextResponse } from "next/server";
import { assignmentsDb } from "@/lib/mysql-assignments/db";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const debug: any = {
      timestamp: new Date().toISOString(),
      session: {
        user: session.user?.email,
        employeeId: session.employee?.id,
        employeeUuid: session.employee?.uuid,
        employeeName: session.employee?.full_name,
        accessLevel: session.access?.level,
      }
    };

    // Cek assignments di database
    try {
      const [assignments] = await assignmentsDb.execute(`
        SELECT
          COUNT(*) as total,
          COUNT(DISTINCT employee_uuid) as unique_employees,
          COUNT(DISTINCT project_uuid) as unique_projects
        FROM assignments
      `);
      debug.assignmentsDb = assignments[0];

      // Ambil sample 5 assignments untuk lihat struktur
      const [sampleAssignments] = await assignmentsDb.execute(`
        SELECT uuid, employee_uuid, project_uuid, start_date, end_date, status
        FROM assignments
        LIMIT 5
      `);
      debug.assignmentSamples = sampleAssignments;
    } catch (err) {
      debug.assignmentsDbError = err instanceof Error ? err.message : String(err);
    }

    // Cek employees dari API
    try {
      const host = request.headers.get('host') || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const baseUrl = `${protocol}://${host}`;

      const empResponse = await fetch(`${baseUrl}/api/employees?limit=5`);
      if (empResponse.ok) {
        const empData = await empResponse.json();
        debug.employeesApi = {
          count: empData.data?.length || 0,
          samples: empData.data?.slice(0, 3).map((e: any) => ({
            id: e.id,
            uuid: e.uuid,
            fullName: e.fullName,
            employeeNumber: e.employeeNumber,
          }))
        };
      } else {
        debug.employeesApiError = `Status: ${empResponse.status}`;
      }
    } catch (err) {
      debug.employeesApiError = err instanceof Error ? err.message : String(err);
    }

    // Cek projects dari API
    try {
      const projResponse = await fetch('/api/projects?limit=5');
      if (projResponse.ok) {
        const projData = await projResponse.json();
        debug.projectsApi = {
          count: projData.data?.length || 0,
          samples: projData.data?.slice(0, 3).map((p: any) => ({
            id: p.id,
            name: p.name,
            brandId: p.brandId,
          }))
        };
      } else {
        debug.projectsApiError = `Status: ${projResponse.status}`;
      }
    } catch (err) {
      debug.projectsApiError = err instanceof Error ? err.message : String(err);
    }

    // Cek mapping - apakah employee_uuid di assignments ada di employees API
    try {
      const [assignmentEmployees] = await assignmentsDb.execute(`
        SELECT DISTINCT employee_uuid FROM assignments LIMIT 10
      `);

      const employeeUuids = assignmentEmployees.map((a: any) => a.employee_uuid);

      // Cek satu per satu apakah UUID ini ada di employees API
      const mappingChecks = [];
      for (const uuid of employeeUuids) {
        const checkResponse = await fetch(`/api/employees/${uuid}`);
        mappingChecks.push({
          assignmentUuid: uuid,
          exists: checkResponse.ok,
          status: checkResponse.status
        });
      }
      debug.mappingCheck = mappingChecks;
    } catch (err) {
      debug.mappingCheckError = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json(debug);
  } catch (error) {
    console.error('[Debug Export] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Debug failed' },
      { status: 500 }
    );
  }
}
