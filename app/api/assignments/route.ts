import { NextResponse } from "next/server";

// Assignments not available in MySQL API yet - return empty data
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
      hasMore: false,
    });
  } catch (error) {
    console.error("Failed to fetch assignments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, error: "Creating assignments via MySQL API not yet implemented" },
    { status: 501 }
  );
}
