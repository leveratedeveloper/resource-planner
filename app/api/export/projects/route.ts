/**
 * Export Projects API Route
 * GET /api/export/projects
 *
 * Export project status and budget information to CSV format
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getExportAccessFilter, getExportMetadata } from '@/lib/export/permissions';
import { exportProjectsToCSV, generateExportFilename } from '@/lib/export/csv-export';
import {
  fetchAssignmentsWithDetails,
  fetchAllCampaigns,
} from '@/lib/export/data-fetcher';

/**
 * GET /api/export/projects
 * Export project report to CSV
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
    const format = searchParams.get('format') || 'csv';

    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Use /api/export/projects/excel for Excel format' },
        { status: 400 }
      );
    }

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
      // Return empty CSV with headers instead of 404
      console.log('[Export Projects] No projects found, returning empty CSV');
      const emptyCsv = 'Project Name,Project Number,Project ID,Brand,Status,Budget,Currency,Start Date,End Date,Allocated Resources,Total Assigned Hours,IO Number\n';
      return new NextResponse(emptyCsv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${generateExportFilename('projects', 'csv')}"`,
        },
      });
    }

    // Fetch all assignments to calculate allocated resources and hours
    const allAssignments = await fetchAssignmentsWithDetails({}, request);

    // Build export data
    const exportData = campaigns.map(campaign => {
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

    // Generate CSV
    const csvContent = exportProjectsToCSV(exportData);

    // Get export metadata
    const metadata = await getExportMetadata();

    // Generate filename
    const filename = generateExportFilename('projects', 'csv');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Metadata': JSON.stringify(metadata),
      },
    });
  } catch (error) {
    console.error('[API /export/projects] Export failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export projects' },
      { status: 500 }
    );
  }
}
