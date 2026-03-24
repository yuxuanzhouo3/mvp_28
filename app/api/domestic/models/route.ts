import { NextResponse } from "next/server";
import { externalModels } from "@/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hasDashscopeKey = !!process.env.DASHSCOPE_API_KEY;

  const models = externalModels.filter((m) => {
    if (m.category !== "domestic") return false;
    return hasDashscopeKey; // DashScope 兼容模式下仅需一个密钥即可按模型名切换
  });
  return NextResponse.json({ success: true, data: models });
}
