import { NextResponse } from "next/server";
import { externalModels } from "@/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hasKey = !!process.env.MISTRAL_API_KEY;
  const models = externalModels.filter(
    (m) => m.category === "international" && hasKey
  );
  return NextResponse.json({ success: true, data: models });
}
