import { NextResponse } from "next/server";

// Project categories not available in MySQL API yet - return empty data
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
      hasMore: false,
    });
  } catch (error) {
    console.error("Failed to fetch project categories:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch project categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, error: "Creating project categories via MySQL API not yet implemented" },
    { status: 501 }
  );
}
