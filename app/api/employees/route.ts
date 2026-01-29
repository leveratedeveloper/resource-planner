import { NextResponse } from "next/server";
import { getAllEmployees, createEmployee, getEmployeesPaginated } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const search = searchParams.get("search");
    
    // If pagination params are provided, use paginated query
    if (limit !== null && offset !== null) {
      const result = await getEmployeesPaginated(
        parseInt(limit, 10),
        parseInt(offset, 10),
        search || undefined
      );
      return NextResponse.json({ 
        success: true, 
        data: result.data,
        total: result.total,
        hasMore: result.hasMore,
      });
    }
    
    // Otherwise use the regular query (for backward compatibility)
    const employees = await getAllEmployees();
    return NextResponse.json({ success: true, data: employees });
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.fullName || !body.position) {
      return NextResponse.json(
        { success: false, error: "Full name and position are required" },
        { status: 400 }
      );
    }
    
    const employee = await createEmployee({
      employeeNumber: body.employeeNumber || null,
      fullName: body.fullName,
      nickname: body.nickname || null,
      email: body.email || null,
      photo: body.photo || null,
      position: body.position,
      departmentId: body.departmentId || null,
      businessUnitId: body.businessUnitId || null,
      directSupervisorId: body.directSupervisorId || null,
      weeklyCapacity: body.weeklyCapacity ?? 40,
      workStartDate: body.workStartDate || null,
      dateOfBirth: body.dateOfBirth || null,
      employmentStatus: body.employmentStatus || "active",
      visibility: body.visibility || "active",
    });
    
    return NextResponse.json({ success: true, data: employee }, { status: 201 });
  } catch (error) {
    console.error("Failed to create employee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create employee" },
      { status: 500 }
    );
  }
}
