import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IS_DOMESTIC_VERSION } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;
    const secret = req.nextUrl.searchParams.get('secret');

    let shareData: any;
    let conversationData: any;

    if (IS_DOMESTIC_VERSION) {
      // CloudBase 查询
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();

      // 获取分享记录
      const shareResult = await db.collection('conversation_shares')
        .where({ share_id: shareId })
        .get();

      if (!shareResult.data || shareResult.data.length === 0) {
        return Response.json({ success: false, error: 'Share not found' }, { status: 404 });
      }

      shareData = shareResult.data[0];

      // 验证密钥（如果不是公开分享）
      if (!shareData.is_public && shareData.secret !== secret) {
        return Response.json({ success: false, error: 'Invalid secret' }, { status: 403 });
      }

      // 检查是否过期
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        return Response.json({ success: false, error: 'Share expired' }, { status: 410 });
      }

      // 获取对话数据
      const conversationResult = await db.collection('conversations')
        .doc(shareData.conversation_id)
        .get();

      if (!conversationResult.data || conversationResult.data.length === 0) {
        return Response.json({ success: false, error: 'Conversation not found' }, { status: 404 });
      }

      conversationData = conversationResult.data[0];

      // 获取消息数据
      const messagesResult = await db.collection('messages')
        .where({ conversationId: shareData.conversation_id })
        .get();

      conversationData.messages = messagesResult.data || [];

      // 更新访问次数
      await db.collection('conversation_shares')
        .doc(shareData._id)
        .update({
          access_count: (shareData.access_count || 0) + 1,
          updated_at: new Date(),
        });

    } else {
      // Supabase 查询
      const supabase = await createClient();

      // 获取分享记录
      const { data: share, error: shareError } = await supabase
        .from('conversation_shares')
        .select('*')
        .eq('share_id', shareId)
        .single();

      if (shareError || !share) {
        return Response.json({ success: false, error: 'Share not found' }, { status: 404 });
      }

      shareData = share;

      // 验证密钥
      if (!share.is_public && share.secret !== secret) {
        return Response.json({ success: false, error: 'Invalid secret' }, { status: 403 });
      }

      // 检查是否过期
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return Response.json({ success: false, error: 'Share expired' }, { status: 410 });
      }

      // 获取对话数据
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', share.conversation_id)
        .single();

      if (conversationError || !conversation) {
        return Response.json({ success: false, error: 'Conversation not found' }, { status: 404 });
      }

      conversationData = conversation;

      // 获取消息数据
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', share.conversation_id)
        .order('created_at', { ascending: true });

      conversationData.messages = messages || [];

      // 更新访问次数
      await supabase
        .from('conversation_shares')
        .update({
          access_count: (share.access_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', share.id);
    }

    const responseData = {
      success: true,
      data: {
        title: conversationData.title || '未命名对话',
        messages: conversationData.messages || [],
        createdAt: shareData.created_at,
        accessCount: (shareData.access_count || 0) + 1,
      },
    };

    return Response.json(responseData);
  } catch (error) {
    console.error("Share access error:", error);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
