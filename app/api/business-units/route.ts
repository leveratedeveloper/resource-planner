import { NextResponse } from "next/server";

// Business units not available in MySQL API yet - return empty data
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
      hasMore: false,
    });
  } catch (error) {
    console.error("Failed to fetch business units:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch business units" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, error: "Creating business units via MySQL API not yet implemented" },
    { status: 501 }
  );
}
