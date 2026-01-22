import { NextResponse } from "next/server";
import { getEmployeeById, updateEmployee, deleteEmployee } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employee = await getEmployeeById(id);
    
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    console.error("Failed to fetch employee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employee" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const employee = await updateEmployee(id, {
      employeeNumber: body.employeeNumber,
      fullName: body.fullName,
      nickname: body.nickname,
      email: body.email,
      photo: body.photo,
      position: body.position,
      departmentId: body.departmentId,
      businessUnitId: body.businessUnitId,
      directSupervisorId: body.directSupervisorId,
      weeklyCapacity: body.weeklyCapacity,
      workStartDate: body.workStartDate,
      dateOfBirth: body.dateOfBirth,
      employmentStatus: body.employmentStatus,
      visibility: body.visibility,
    });
    
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    console.error("Failed to update employee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update employee" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteEmployee(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete employee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}
