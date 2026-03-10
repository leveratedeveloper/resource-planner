import { NextResponse } from "next/server";

// Departments not available in MySQL API yet - return empty data
// Note: Department data is included in employee responses
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
      hasMore: false,
    });
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch departments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, error: "Creating departments via MySQL API not yet implemented" },
    { status: 501 }
  );
}
