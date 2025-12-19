import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve favicon.ico by redirecting to the logo
 * This handles the default browser request for /favicon.ico
 */
export async function GET(request: NextRequest) {
  try {
    // Redirect to the logo28.png which is already configured as the icon
    return NextResponse.redirect(new URL("/logo28.png", request.url), 301);
  } catch (error) {
    // If redirect fails, return 204 No Content (browsers will handle this gracefully)
    return new NextResponse(null, { status: 204 });
  }
}

