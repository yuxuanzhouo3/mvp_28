import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export interface PublicSocialLink {
  id: string;
  title: string;
  description: string | null;
  icon_url: string;
  target_url: string;
  sort_order: number;
}

/**
 * GET /api/social-links/active
 * 获取活跃的社交链接（公开接口，无需认证）
 * Query params:
 *   - isDomestic: "true" | "false"
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const isDomestic = searchParams.get("isDomestic") === "true";

    const links: PublicSocialLink[] = [];

    if (isDomestic) {
      // 国内版：从 CloudBase 获取
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const app = connector.getApp();

        console.log(`[CloudBase] Querying social links with is_active=true`);

        const { data } = await db
          .collection("social_links")
          .where({
            is_active: true,
          })
          .orderBy("sort_order", "asc")
          .limit(50)
          .get();

        console.log(`[CloudBase] Found ${data?.length || 0} active social links`);

        if (data && Array.isArray(data)) {
          // 收集需要获取临时 URL 的 fileID
          const fileIdMap = new Map<string, any>();

          for (const link of data) {
            if (link.icon_url && link.icon_url.startsWith("cloud://")) {
              fileIdMap.set(link.icon_url, link);
            } else {
              // 已经是临时 URL，直接使用
              links.push({
                id: link._id || link.id,
                title: link.title,
                description: link.description,
                icon_url: link.icon_url,
                target_url: link.target_url,
                sort_order: link.sort_order,
              });
            }
          }

          // 批量获取临时 URL
          if (fileIdMap.size > 0) {
            try {
              const fileIds = Array.from(fileIdMap.keys());
              const urlResult = await app.getTempFileURL({
                fileList: fileIds,
              });

              if (urlResult.fileList && Array.isArray(urlResult.fileList)) {
                for (const fileInfo of urlResult.fileList) {
                  const link = fileIdMap.get(fileInfo.fileID);
                  if (link && fileInfo.code === "SUCCESS" && fileInfo.tempFileURL) {
                    links.push({
                      id: link._id || link.id,
                      title: link.title,
                      description: link.description,
                      icon_url: fileInfo.tempFileURL,
                      target_url: link.target_url,
                      sort_order: link.sort_order,
                    });
                  }
                }
              }
            } catch (urlErr) {
              console.error("CloudBase getTempFileURL error:", urlErr);
            }
          }
        }
      } catch (err) {
        console.error("CloudBase getActiveSocialLinks error:", err);
        return NextResponse.json(
          { success: false, error: "获取社交链接失败" },
          { status: 500 }
        );
      }
    } else {
      // 国际版：从 Supabase 获取
      if (!supabaseAdmin) {
        return NextResponse.json(
          { success: false, error: "Supabase 未配置" },
          { status: 500 }
        );
      }

      try {
        const { data, error } = await supabaseAdmin
          .from("social_links")
          .select("id, title, description, icon_url, target_url, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(50);

        if (error) {
          console.error("Supabase getActiveSocialLinks error:", error);
          return NextResponse.json(
            { success: false, error: "获取社交链接失败" },
            { status: 500 }
          );
        }

        if (data) {
          for (const link of data) {
            links.push({
              id: link.id,
              title: link.title,
              description: link.description,
              icon_url: link.icon_url,
              target_url: link.target_url,
              sort_order: link.sort_order,
            });
          }
        }
      } catch (err) {
        console.error("Supabase getActiveSocialLinks exception:", err);
        return NextResponse.json(
          { success: false, error: "获取社交链接失败" },
          { status: 500 }
        );
      }
    }

    // 按排序顺序排序
    links.sort((a, b) => a.sort_order - b.sort_order);

    return NextResponse.json({
      success: true,
      data: links,
    });
  } catch (err) {
    console.error("getActiveSocialLinks error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "获取社交链接失败" },
      { status: 500 }
    );
  }
}
