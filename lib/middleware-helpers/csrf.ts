// lib/middleware-helpers/csrf.ts - CSRF helper for API routes
import { NextRequest, NextResponse } from "next/server";
import { csrfProtection } from "@/lib/security/csrf";

/**
 * CSRF middleware helper for API routes
 * Use this in API routes that need CSRF protection
 */
export async function checkCSRF(
  request: NextRequest
): Promise<NextResponse | null> {
  // Create a dummy response for csrfProtection
  const dummyResponse = NextResponse.next();
  
  // Check CSRF
  const csrfResponse = await csrfProtection(request, dummyResponse);
  
  // If CSRF check failed, return the error response
  if (csrfResponse.status !== 200) {
    return csrfResponse;
  }
  
  // CSRF check passed
  return null;
}

