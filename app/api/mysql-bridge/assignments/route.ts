import { NextResponse } from 'next/server';
import { getMySqlApiClient } from '@/lib/mysql/api-client';
import { getSession } from '@/lib/auth/session';
import type { MySqlCreateAssignmentRequest } from '@/lib/types/mysql';

/**
 * Validation helper for assignment creation
 */
function validateAssignment(data: MySqlCreateAssignmentRequest): { valid: boolean; error?: string } {
  if (!data.employee_uuid) {
    return { valid: false, error: 'employee_uuid is required' };
  }

  if (!data.start_date) {
    return { valid: false, error: 'start_date is required' };
  }

  if (!data.end_date) {
    return { valid: false, error: 'end_date is required' };
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.start_date)) {
    return { valid: false, error: 'start_date must be in YYYY-MM-DD format' };
  }

  if (!dateRegex.test(data.end_date)) {
    return { valid: false, error: 'end_date must be in YYYY-MM-DD format' };
  }

  // Validate date range
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);

  if (endDate < startDate) {
    return { valid: false, error: 'end_date must be after start_date' };
  }

  // Validate hours_per_day if provided
  if (data.hours_per_day) {
    const hours = parseFloat(data.hours_per_day);
    if (isNaN(hours) || hours < 0 || hours > 24) {
      return { valid: false, error: 'hours_per_day must be between 0 and 24' };
    }
  }

  return { valid: true };
}

/**
 * GET /api/mysql-bridge/assignments
 * Proxy endpoint for fetching assignments from MySQL API
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeUuid = searchParams.get('employee_uuid') || undefined;
    const projectUuid = searchParams.get('project_uuid') || undefined;
    const startDate = searchParams.get('start_date') || undefined;
    const endDate = searchParams.get('end_date') || undefined;

    const client = getMySqlApiClient(async () => session.access_token);
    const response = await client.getAssignments({
      employee_uuid: employeeUuid,
      project_uuid: projectUuid,
      start_date: startDate,
      end_date: endDate,
    });

    // Check for API errors from the client
    if (response.error) {
      console.error('[MySQL Bridge] Assignments API error:', response.error);
      return NextResponse.json(
        {
          success: false,
          error: response.error.message,
          errorType: response.error.type,
          data: [],
        },
        { status: response.status === 200 ? 500 : response.status }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch MySQL assignments:', error);

    const statusCode = error instanceof Error && 'statusCode' in error
      ? (error as { statusCode: number }).statusCode
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
      },
      { status: statusCode }
    );
  }
}

/**
 * POST /api/mysql-bridge/assignments
 * Proxy endpoint for creating assignments via MySQL API
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body: MySqlCreateAssignmentRequest = await request.json();

    // Validate required fields
    const validation = validateAssignment(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    console.log('[MySQL Bridge] Creating assignment:', {
      employee_uuid: body.employee_uuid,
      project_uuid: body.project_uuid,
      start_date: body.start_date,
      end_date: body.end_date,
    });

    const client = getMySqlApiClient(async () => session.access_token);
    const response = await client.createAssignment(body);

    // Check for API errors from the client
    if (response.error) {
      console.error('[MySQL Bridge] Assignment creation API error:', response.error);
      return NextResponse.json(
        {
          success: false,
          error: response.error.message,
          errorType: response.error.type,
        },
        { status: response.status === 200 ? 500 : response.status }
      );
    }

    console.log('[MySQL Bridge] Assignment created successfully:', response.data?.uuid);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Failed to create MySQL assignment:', error);

    const statusCode = error instanceof Error && 'statusCode' in error
      ? (error as { statusCode: number }).statusCode
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: statusCode }
    );
  }
}
