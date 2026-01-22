import { NextResponse } from "next/server";
import { getAllEmployees, createEmployee } from "@/lib/db/queries";

export async function GET() {
  try {
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
