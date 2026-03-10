import { NextResponse } from "next/server";

// Channel classifications not available in MySQL API yet - return empty data
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
      hasMore: false,
    });
  } catch (error) {
    console.error("Failed to fetch channel classifications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch channel classifications" },
      { status: 500 }
    );
  }
}
