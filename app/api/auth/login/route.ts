import { NextRequest, NextResponse } from 'next/server';
import { login, getUserWithProfile, getDepartment } from '@/lib/api/timetrack-client';
import { determineAccessLevel } from '@/lib/auth/access-level';
import { createSession, SessionData } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    console.log('[Login API] Login attempt for:', email);

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 1. Call timetrack login API
    const loginResult = await login(email, password);

    console.log('[Login API] Login result:', {
      success: loginResult.success,
      hasData: !!loginResult.data,
      message: loginResult.message
    });

    if (!loginResult.success || !loginResult.data) {
      return NextResponse.json(
        { error: loginResult.message || 'Invalid credentials' },
        { status: 401 }
      );
    }

    const { access_token, user } = loginResult.data;

    // 2. Fetch user with profile (employee data)
    const userProfile = await getUserWithProfile(access_token, user.id);

    if (!userProfile.data || !userProfile.data.profile) {
      console.log('[Login API] No employee profile found for user');
      return NextResponse.json(
        { error: 'No employee profile found for this user' },
        { status: 404 }
      );
    }

    const employee = userProfile.data.profile;

    // 3. Fetch department data to get department_name
    let department_name = 'Unknown';
    if (employee.dept_id) {
      const deptResult = await getDepartment(access_token, employee.dept_id);
      if (deptResult.data && deptResult.data.department_name) {
        department_name = deptResult.data.department_name;
      }
    }

    console.log('[Login API] Employee data:', {
      id: employee.id,
      name: employee.full_name || employee.name,
      department: department_name,
      position: employee.position
    });

    // 4. Determine access level
    const accessLevel = determineAccessLevel({
      department_name,
      position: employee.position
    });
    console.log('[Login API] Access level determined:', accessLevel);

    // 5. Create session with all data
    const session: SessionData = {
      access_token,
      user,
      employee: {
        id: employee.id,
        uuid: employee.uuid || '',
        nik: employee.nik || '',
        full_name: employee.full_name || employee.name || '',
        nickname: employee.nickname || employee.name || '',
        position: employee.position || '',
        dept_id: employee.dept_id || 0,
        department_name,
        photo: employee.photo || ''
      },
      access: {
        level: accessLevel,
        can_view_all: accessLevel === 'full',
        can_view_own_only: accessLevel === 'restricted'
      }
    };

    // 6. Set session cookie
    await createSession(session);

    // Return session data (without sensitive token in response body)
    const { access_token: _, ...sessionResponse } = session;

    return NextResponse.json({
      success: true,
      data: sessionResponse
    });

  } catch (error) {
    console.error('[Login API] Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
