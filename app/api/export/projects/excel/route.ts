/**
 * Export Projects Excel API Route
 * GET /api/export/projects/excel
 *
 * Export project status and budget information to Excel format with multiple sheets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getExportAccessFilter, getExportMetadata } from '@/lib/export/permissions';
import { exportProjectsToExcel, generateExcelFilename } from '@/lib/export/excel-export';
import type { ProjectExportData } from '@/lib/export/csv-export';
import {
  fetchAssignmentsWithDetails,
  fetchAllCampaigns,
} from '@/lib/export/data-fetcher';

/**
 * GET /api/export/projects/excel
 * Export project report to Excel
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const brandIds = searchParams.get('brandIds');
    const projectIds = searchParams.get('projectIds');
    const groupByBrand = searchParams.get('groupByBrand') !== 'false';
    const includeSummary = searchParams.get('includeSummary') !== 'false';

    // Get access filter (for projects, full access vs restricted doesn't matter much as we show all)
    await getExportAccessFilter();

    // Fetch campaigns/projects
    let campaigns = await fetchAllCampaigns(request);

    // Apply brand filter if specified
    if (brandIds) {
      const brandIdArray = brandIds.split(',').map(id => parseInt(id, 10));
      campaigns = campaigns.filter(c => brandIdArray.includes(c.brand_id));
    }

    // Apply project filter if specified
    if (projectIds) {
      const projectIdArray = projectIds.split(',');
      campaigns = campaigns.filter(c => projectIdArray.includes(c.uuid));
    }

    if (campaigns.length === 0) {
      // Return empty Excel with just headers
      console.log('[Export Projects Excel] No projects found, returning empty Excel');
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Summary');
      worksheet.addRow(['No projects found']);
      worksheet.addRow(['Try adjusting your filters or check if projects exist.']);
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(Buffer.from(buffer)), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${generateExcelFilename('projects-report')}"`,
        },
      });
    }

    // Fetch all assignments to calculate allocated resources and hours
    const allAssignments = await fetchAssignmentsWithDetails({}, request);

    // Build export data
    const exportData: ProjectExportData[] = campaigns.map(campaign => {
      // Get assignments for this project
      const projectAssignments = allAssignments.filter(
        a => a.project_uuid === campaign.uuid
      );

      // Calculate unique resources and total assigned hours
      const uniqueResources = new Set(projectAssignments.map(a => a.employee_uuid));
      let totalAssignedHours = 0;

      for (const assignment of projectAssignments) {
        const hoursPerDay = assignment.hours_per_day;
        const startDate = new Date(assignment.start_date);
        const endDate = new Date(assignment.end_date);
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        totalAssignedHours += hoursPerDay * days;
      }

      return {
        projectName: campaign.campaign_name,
        projectNumber: campaign.io_number,
        projectUuid: campaign.uuid,
        brandName: campaign.brand_name || campaign.company_name || 'Unknown',
        status: campaign.state === 'publish' ? 'Active' :
                campaign.state === 'draft' ? 'Draft' : 'Archived',
        budget: campaign.budget,
        currency: campaign.currency,
        startDate: campaign.start_date,
        endDate: campaign.end_date,
        allocatedResources: uniqueResources.size,
        totalAssignedHours: Math.round(totalAssignedHours),
        ioNumber: campaign.io_number,
      };
    });

    if (exportData.length === 0) {
      return NextResponse.json(
        { error: 'No project data found' },
        { status: 404 }
      );
    }

    // Generate Excel
    const buffer = await exportProjectsToExcel({
      projects: exportData,
      groupByBrand,
      includeSummary,
    });

    // Get export metadata
    const metadata = await getExportMetadata();

    // Generate filename
    const filename = generateExcelFilename('projects-report');

    // Return Excel file
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Metadata': JSON.stringify(metadata),
      },
    });
  } catch (error) {
    console.error('[API /export/projects/excel] Export failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export projects to Excel' },
      { status: 500 }
    );
  }
}
