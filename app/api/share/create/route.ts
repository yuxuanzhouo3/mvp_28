import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseAuthService } from "@/lib/cloudbase/auth";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getDomesticUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  const auth = new CloudBaseAuthService();
  return await auth.validateToken(token);
}

function generateShareId() {
  return nanoid(12); // 生成12位唯一ID
}

function generateSecret() {
  return nanoid(8).toUpperCase(); // 生成8位大写密钥
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, conversationId, makePublic, expiresInDays = 7 } = body;

    // 兼容 chatId 和 conversationId 两种参数名
    const actualConversationId = conversationId || chatId;

    if (!actualConversationId) {
      return Response.json({ success: false, error: "Conversation ID is required" }, { status: 400 });
    }

    let userId: string;

    // 验证用户身份并获取userId
    if (IS_DOMESTIC_VERSION) {
      const user = await getDomesticUser(req);
      if (!user) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
    } else {
      const supabase = await createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      userId = userData.user.id;
    }

    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    let shareId: string;
    let secret: string | null;
    let shareLink: string;

    // 保存到数据库
    if (IS_DOMESTIC_VERSION) {
      // CloudBase 存储
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

      // 1. 清理该对话的过期分享
      const expiredShares = await db.collection('conversation_shares')
        .where({
          conversation_id: actualConversationId,
          expires_at: db.command.lt(new Date())
        })
        .get();

      for (const share of expiredShares.data || []) {
        await db.collection('conversation_shares').doc(share._id).remove();
      }

      // 2. 检查是否已存在有效分享（相同的公开/私密设置）
      const existingShares = await db.collection('conversation_shares')
        .where({
          conversation_id: actualConversationId,
          user_id: userId,
          is_public: makePublic,
          expires_at: db.command.gte(new Date())
        })
        .get();

      if (existingShares.data && existingShares.data.length > 0) {
        // 复用现有分享
        const existing = existingShares.data[0];
        return Response.json({
          success: true,
          shareLink: `${req.nextUrl.origin}/share/${existing.share_id}`,
          secret: existing.secret || '',
          reused: true, // 标记为复用
        });
      }

      // 3. 检查用户的总分享数量（防止滥用）
      const userShares = await db.collection('conversation_shares')
        .where({
          user_id: userId,
          expires_at: db.command.gte(new Date())
        })
        .get();

      if (userShares.data && userShares.data.length >= 50) {
        return Response.json({
          success: false,
          error: 'Maximum 50 active shares per user. Please delete old shares first.'
        }, { status: 429 });
      }

      // 4. 检查该对话的有效分享数量（限制最多5个）
      const validShares = await db.collection('conversation_shares')
        .where({
          conversation_id: actualConversationId,
          expires_at: db.command.gte(new Date())
        })
        .get();

      if (validShares.data && validShares.data.length >= 5) {
        return Response.json({
          success: false,
          error: 'Maximum 5 active shares per conversation. Please delete old shares first.'
        }, { status: 429 });
      }

      // 5. 创建新分享
      shareId = generateShareId();
      secret = makePublic ? null : generateSecret();
      shareLink = `${req.nextUrl.origin}/share/${shareId}`;

      await db.collection('conversation_shares').add({
        share_id: shareId,
        conversation_id: actualConversationId,
        user_id: userId,
        secret: secret,
        is_public: makePublic,
        expires_at: expiresAt,
        access_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } else {
      // Supabase 存储
      const supabase = await createClient();

      // 1. 清理该对话的过期分享
      await supabase
        .from('conversation_shares')
        .delete()
        .eq('conversation_id', actualConversationId)
        .lt('expires_at', new Date().toISOString());

      // 2. 检查是否已存在有效分享（相同的公开/私密设置）
      const { data: existingShares } = await supabase
        .from('conversation_shares')
        .select('*')
        .eq('conversation_id', actualConversationId)
        .eq('user_id', userId)
        .eq('is_public', makePublic)
        .gte('expires_at', new Date().toISOString())
        .limit(1);

      if (existingShares && existingShares.length > 0) {
        // 复用现有分享
        const existing = existingShares[0];
        return Response.json({
          success: true,
          shareLink: `${req.nextUrl.origin}/share/${existing.share_id}`,
          secret: existing.secret || '',
          reused: true,
        });
      }

      // 3. 检查用户的总分享数量（防止滥用）
      const { count: userShareCount } = await supabase
        .from('conversation_shares')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('expires_at', new Date().toISOString());

      if (userShareCount && userShareCount >= 50) {
        return Response.json({
          success: false,
          error: 'Maximum 50 active shares per user. Please delete old shares first.'
        }, { status: 429 });
      }

      // 4. 检查该对话的有效分享数量（限制最多5个）
      const { data: validShares, count } = await supabase
        .from('conversation_shares')
        .select('*', { count: 'exact' })
        .eq('conversation_id', actualConversationId)
        .gte('expires_at', new Date().toISOString());

      if (count && count >= 5) {
        return Response.json({
          success: false,
          error: 'Maximum 5 active shares per conversation. Please delete old shares first.'
        }, { status: 429 });
      }

      // 5. 创建新分享
      shareId = generateShareId();
      secret = makePublic ? null : generateSecret();
      shareLink = `${req.nextUrl.origin}/share/${shareId}`;

      const { error } = await supabase.from('conversation_shares').insert({
        share_id: shareId,
        conversation_id: actualConversationId,
        user_id: userId,
        secret: secret,
        is_public: makePublic,
        expires_at: expiresAt.toISOString(),
      });

      if (error) {
        console.error('Database error:', error);
        return Response.json({ success: false, error: 'Failed to create share' }, { status: 500 });
      }
    }

    return Response.json({
      success: true,
      shareLink,
      secret: secret || '',
    });
  } catch (error) {
    console.error("Share API error:", error);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
