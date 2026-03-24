import { NextResponse } from "next/server";
import { externalModels } from "@/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasMistralKey = !!process.env.MISTRAL_API_KEY;
  const hasTwelveLabsKey = !!process.env.TWELVELABS_API_KEY;

  const models = externalModels.filter((m) => {
    if (m.category !== "international") return false;
    const provider = (m.provider || "").toLowerCase();
    if (provider === "mistral") return hasMistralKey;
    if (provider === "gemini") return hasGeminiKey;
    if (provider === "twelvelabs") return hasTwelveLabsKey;
    return true;
  });

  return NextResponse.json({ success: true, data: models });
}
