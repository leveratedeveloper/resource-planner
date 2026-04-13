/**
 * Test Export Data API
 * Test endpoint untuk mengecek apakah data export bisa diambil
 */

import { NextRequest, NextResponse } from "next/server";
import { assignmentsDb } from "@/lib/mysql-assignments/db";

export async function GET() {
  const result: any = {
    timestamp: new Date().toISOString(),
  };

  // 1. Cek assignments di database
  try {
    const [countResult] = await assignmentsDb.execute(`
      SELECT COUNT(*) as count FROM assignments
    `);
    result.assignmentsCount = countResult[0]?.count || 0;

    // Ambil sample assignments
    if (result.assignmentsCount > 0) {
      const [samples] = await assignmentsDb.execute(`
        SELECT uuid, employee_uuid, project_uuid, start_date, end_date, status
        FROM assignments
        ORDER BY created_at DESC
        LIMIT 3
      `);
      result.assignmentSamples = samples;
    }
  } catch (err) {
    result.assignmentsError = err instanceof Error ? err.message : String(err);
  }

  // 2. Cek employees dari Next.js API (yang sudah ada authentication)
  try {
    const empResponse = await fetch('http://localhost:3000/api/employees?limit=3');
    result.employeesFetch = {
      ok: empResponse.ok,
      status: empResponse.status,
    };

    if (empResponse.ok) {
      const empData = await empResponse.json();
      result.employeesData = {
        total: empData.data?.length || 0,
        samples: empData.data?.slice(0, 2).map((e: any) => ({
          id: e.id,
          uuid: e.uuid,
          fullName: e.fullName,
          employeeNumber: e.employeeNumber,
        }))
      };
    }
  } catch (err) {
    result.employeesFetchError = err instanceof Error ? err.message : String(err);
  }

  // 3. Cek projects dari Next.js API
  try {
    const projResponse = await fetch('http://localhost:3000/api/projects?limit=3');
    result.projectsFetch = {
      ok: projResponse.ok,
      status: projResponse.status,
    };

    if (projResponse.ok) {
      const projData = await projResponse.json();
      result.projectsData = {
        total: projData.data?.length || 0,
        samples: projData.data?.slice(0, 2).map((p: any) => ({
          id: p.id,
          name: p.name,
          brandId: p.brandId,
        }))
      };
    }
  } catch (err) {
    result.projectsFetchError = err instanceof Error ? err.message : String(err);
  }

  // 4. Test mapping - apakah employee_uuid dari assignments bisa dicari di employees API
  if (result.assignmentSamples && result.assignmentSamples.length > 0) {
    const testUuid = result.assignmentSamples[0].employee_uuid;

    try {
      const testResponse = await fetch(`http://localhost:3000/api/employees?search=${testUuid}`);
      result.mappingTest = {
        assignmentEmployeeUuid: testUuid,
        searchResponse: {
          ok: testResponse.ok,
          status: testResponse.status,
        }
      };

      if (testResponse.ok) {
        const searchData = await testResponse.json();
        result.mappingTest.found = searchData.data?.length || 0;
        result.mappingTest.samples = searchData.data?.slice(0, 2);
      }
    } catch (err) {
      result.mappingTestError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json(result);
}
