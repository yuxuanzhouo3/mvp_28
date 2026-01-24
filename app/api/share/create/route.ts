import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getDomesticUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  const auth = new CloudBaseAuthService();
  return await auth.validateToken(token);
}

function generateShareId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateSecret() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, makePublic } = body;

    if (!chatId) {
      return Response.json({ success: false, error: "Chat ID is required" }, { status: 400 });
    }

    // 验证用户身份
    if (IS_DOMESTIC_VERSION) {
      const user = await getDomesticUser(req);
      if (!user) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    } else {
      const supabase = await createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    // 生成分享链接和密钥
    const shareId = generateShareId();
    const secret = makePublic ? "" : generateSecret();
    const shareLink = `${req.nextUrl.origin}/share/${shareId}`;

    // TODO: 保存分享记录到数据库（需要先创建 shares 集合/表）
    // 暂时跳过数据库保存，直接返回分享链接

    return Response.json({
      success: true,
      shareLink,
      secret,
    });
  } catch (error) {
    console.error("Share API error:", error);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
