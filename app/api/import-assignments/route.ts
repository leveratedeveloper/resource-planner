import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { assignmentsDb } from "@/lib/mysql-assignments/db";
import { distributeMonthlyHours } from "@/lib/utils/allocation-distributor";
import { randomUUID } from "crypto";
import ExcelJS from "exceljs";

export const runtime = 'nodejs';

// Fetch all pages of a resource from MySQL API
async function fetchAllPages(fetchFn: (params: any) => Promise<any>, baseParams: any = {}) {
  let page = 1;
  const perPage = 1000;
  let allData: any[] = [];
  let hasMore = true;

  while (hasMore) {
    const response = await fetchFn({ ...baseParams, page, per_page: perPage });
    if (!response || (response.success === false)) {
      console.log(`[Import] Fetch failed at page ${page}`);
      break;
    }
    
    const dataObj = response.data || response;
    const items = Array.isArray(dataObj) ? dataObj : (dataObj.data || []);
    allData = [...allData, ...items];
    
    const meta = dataObj.meta || dataObj || {};
    const lastPage = meta.last_page || meta.pages || meta.lastPage || 1;
    const currentPage = meta.current_page || meta.page || page;
    
    console.log(`[Import] Fetched page ${currentPage}/${lastPage}, total items so far: ${allData.length}`);
    
    if (currentPage >= lastPage) {
      hasMore = false;
    } else {
      page = currentPage + 1;
    }
    
    // Safety break for unexpected infinite loops
    if (page > 500) break;
  }
  return allData;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!session.access.can_view_all) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(buffer));

    const apiClient = getMySqlApiClient(async () => session.access_token);

    console.log("[Import] Fetching entities from API...");
    const [employees, campaigns, pitches, operationals, rnds, brands, channelsData] = await Promise.all([
      fetchAllPages((p) => apiClient.getEmployees(p)),
      fetchAllPages((p) => apiClient.getCampaigns({ ...p, include: 'channels' })),
      fetchAllPages((p) => apiClient.getPitches({ ...p, include: 'channels' })),
      fetchAllPages((p) => apiClient.getOperationals({ ...p, include: 'channels' })),
      fetchAllPages((p) => apiClient.getRnds({ ...p, include: 'channels' })),
      fetchAllPages((p) => apiClient.getBrands(p)),
      fetchAllPages((p) => apiClient.getChannelClassifications(p)),
    ]);

    console.log(`[Import] API Stats: Employees=${employees.length}, Campaigns=${campaigns.length}, Pitches=${pitches.length}, Operationals=${operationals.length}, RnDs=${rnds.length}, Brands=${brands.length}, Channels=${channelsData.length}`);

    // Map channel IDs to names
    const channelMap = new Map<string, string>();
    channelsData.forEach((c: any) => {
      const name = c.channel_name_new || c.channel_name;
      if (name) channelMap.set(String(c.id), String(name).toLowerCase().trim());
    });

    const allProjects = [...campaigns, ...pitches, ...operationals, ...rnds].map(p => ({
      id: p.uuid || p.id,
      name: p.campaign_name || p.pitch_name,
      brandId: p.brand_id ? String(p.brand_id) : null,
      channels: p.channels || []
    }));

    // Index projects by brandId for fast lookup
    const projectsByBrand = new Map<string, any[]>();
    allProjects.forEach(p => {
      if (!p.brandId) return;
      if (!projectsByBrand.has(p.brandId)) projectsByBrand.set(p.brandId, []);
      projectsByBrand.get(p.brandId)!.push(p);
    });

    // Map brand names to IDs
    const brandMap = new Map<string, string>();
    brands.forEach((b: any) => {
      const bId = String(b.brand_id || b.id || b.uuid);
      const name = b.brand_name?.toLowerCase().trim();
      if (name) brandMap.set(name, bId);
      const company = b.company_name?.toLowerCase().trim();
      if (company && company !== name) brandMap.set(company, bId);
    });

    // Map employee names to UUIDs
    const employeeMap = new Map<string, string>();
    employees.forEach((emp: any) => {
      const full = (emp.full_name || emp.employee_name || emp.name || '').toLowerCase().trim();
      const nick = (emp.nickname || emp.nick_name || '').toLowerCase().trim();
      const first = full.split(' ')[0];
      if (full) employeeMap.set(full, emp.uuid);
      if (nick && nick !== full) employeeMap.set(nick, emp.uuid);
      if (first && first.length > 2 && !employeeMap.has(first)) {
        employeeMap.set(first, emp.uuid);
      }
    });

    const monthsMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      mei: 4, agt: 7, okt: 9, nop: 10, des: 11
    };

    const now = new Date();
    const currentYear = now.getFullYear();
    let totalAssignmentsCreated = 0;
    let failedRowsCount = 0;

    const connection = await assignmentsDb.getConnection();
    try {
      for (const sheet of workbook.worksheets) {
        const sheetName = sheet.name.toLowerCase().trim();
        const monthMatch = sheetName.match(/([a-z]{3})/);
        const yearMatch = sheetName.match(/(\d{2,4})/);
        
        if (!monthMatch || monthsMap[monthMatch[1]] === undefined) continue;
        
        const month = monthsMap[monthMatch[1]];
        let year = currentYear;
        if (yearMatch) {
          const parsedYear = parseInt(yearMatch[1], 10);
          year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
        }

        const startDate = new Date(year, month, 1, 12, 0, 0);
        const endDate = new Date(year, month + 1, 0, 12, 0, 0);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const row8 = sheet.getRow(8).values as any[];
        if (!row8) continue;

        let brandColIdx = -1, channelColIdx = -1, projectColIdx = -1;
        const employeeColumns: { colIdx: number; uuid: string }[] = [];

        for (let i = 1; i < row8.length; i++) {
          const val = String(row8[i] || '').trim().toUpperCase();
          if (val === 'BRAND') brandColIdx = i;
          else if (val === 'CHANNEL') channelColIdx = i;
          else if (val === 'PROJECT') projectColIdx = i;
          else if (row8[i]) {
            const empName = String(row8[i]).trim().toLowerCase();
            const ignore = ['total working hours', 'net working hours', 'capacity', 'no', 'notes', 'pillar', 'position'];
            if (!ignore.some(h => empName.includes(h))) {
              let matchedId = employeeMap.get(empName);
              if (!matchedId) {
                for (const [eName, eId] of employeeMap.entries()) {
                  if (eName.includes(empName) || empName.includes(eName)) {
                    matchedId = eId; break;
                  }
                }
              }
              if (matchedId) employeeColumns.push({ colIdx: i, uuid: matchedId });
            }
          }
        }

        if (brandColIdx === -1 || channelColIdx === -1) continue;

        const processedEmployees = new Set<string>();
        const batchInsertValues: any[] = [];

        for (let r = 11; r <= sheet.rowCount; r++) {
          const row = sheet.getRow(r).values as any[];
          if (!row || !row[brandColIdx]) continue;

          const brandName = String(row[brandColIdx] || '').trim().toLowerCase();
          const channelName = String(row[channelColIdx] || '').trim().toLowerCase();
          const projectName = projectColIdx !== -1 ? String(row[projectColIdx] || '').trim().toLowerCase() : '';

          let brandId = brandMap.get(brandName);
          if (!brandId) {
            for (const [bName, bId] of brandMap.entries()) {
              if (bName.includes(brandName) || brandName.includes(bName)) {
                brandId = bId; break;
              }
            }
          }

          if (!brandId) { failedRowsCount++; continue; }

          const brandProjects = projectsByBrand.get(brandId) || [];
          let matched = brandProjects.filter(p => {
            const hasChannel = p.channels.some((c: any) => {
              const cName = channelMap.get(String(c.channel_id));
              return cName === channelName || cName?.includes(channelName) || channelName.includes(cName || '');
            });
            if (!hasChannel) return false;
            if (projectName && projectName !== 'null') {
              const pName = String(p.name || '').toLowerCase();
              return pName.includes(projectName) || projectName.includes(pName);
            }
            return true;
          });

          if (matched.length === 0) { failedRowsCount++; continue; }

          for (const emp of employeeColumns) {
            const rawVal = row[emp.colIdx];
            const hours = parseFloat(String((rawVal && typeof rawVal === 'object' ? (rawVal as any).result : rawVal) || 0));
            if (hours <= 0 || isNaN(hours)) continue;

            if (!processedEmployees.has(emp.uuid)) {
              await connection.query(
                `DELETE FROM assignments WHERE employee_uuid = ? AND start_date >= ? AND end_date <= ? AND is_time_off = 0`,
                [emp.uuid, startDateStr, endDateStr]
              );
              processedEmployees.add(emp.uuid);
            }

            for (const project of matched) {
              const dist = distributeMonthlyHours({ totalHours: hours, monthStart: startDate, monthEnd: endDate, timeOffAssignments: [] });
              for (const d of dist.distributions) {
                if (d.hours <= 0) continue;
                const dStr = d.date.toISOString().split('T')[0];
                batchInsertValues.push([randomUUID(), emp.uuid, project.id, dStr, dStr, d.hours, d.hours, 0, 'confirmed', now, now]);
              }
            }
          }
        }

        if (batchInsertValues.length > 0) {
          console.log(`[Import] Sheet ${sheet.name}: Inserting ${batchInsertValues.length} assignments...`);
          // Batch insert 500 at a time to avoid parameter limit in PostgreSQL
          for (let i = 0; i < batchInsertValues.length; i += 500) {
            const batch = batchInsertValues.slice(i, i + 500);
            const placeholders = batch.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(', ');
            const flattenedValues = batch.flat();
            
            await connection.query(
              `INSERT INTO assignments (uuid, employee_uuid, project_uuid, start_date, end_date, hours_per_day, total_hours, is_time_off, status, created_at, updated_at) VALUES ${placeholders}`,
              flattenedValues
            );
          }
          totalAssignmentsCreated += batchInsertValues.length;
        }
      }
    } finally {
      connection.release();
    }

    return NextResponse.json({ success: true, createdCount: totalAssignmentsCreated, failedRows: failedRowsCount });
  } catch (error) {
    console.error("[Import] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
