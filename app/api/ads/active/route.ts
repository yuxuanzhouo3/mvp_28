import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

// 广告位置类型
type AdPosition = "top" | "bottom" | "left" | "right" | "sidebar" | "bottom-left" | "bottom-right";

export interface PublicAdvertisement {
  id: string;
  title: string;
  position: AdPosition;
  media_type: "image" | "video";
  media_url: string;
  target_url: string | null;
  priority: number;
}

// 有效的广告位置列表
const VALID_POSITIONS: AdPosition[] = ["top", "bottom", "left", "right", "sidebar", "bottom-left", "bottom-right"];

/**
 * GET /api/ads/active
 * 获取活跃广告（公开接口，无需认证）
 * Query params:
 *   - position: "top" | "bottom" | "left" | "right" | "sidebar"
 *   - isDomestic: "true" | "false"
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const position = searchParams.get("position") as AdPosition;
    const isDomestic = searchParams.get("isDomestic") === "true";

    if (!position || !VALID_POSITIONS.includes(position)) {
      return NextResponse.json(
        { success: false, error: "Invalid position parameter" },
        { status: 400 }
      );
    }

    const ads: PublicAdvertisement[] = [];

    if (isDomestic) {
      // 国内版：从 CloudBase 获取
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const app = connector.getApp();

        const { data } = await db
          .collection("advertisements")
          .where({
            position,
            is_active: true,
          })
          .orderBy("priority", "desc")
          .limit(10)
          .get();

        if (data && Array.isArray(data)) {
          // 收集需要获取临时 URL 的 fileID
          const fileIdMap = new Map<string, any>();

          for (const ad of data) {
            if (ad.media_url && ad.media_url.startsWith("cloud://")) {
              fileIdMap.set(ad.media_url, ad);
            } else {
              // 已经是临时 URL，直接使用
              ads.push({
                id: ad._id || ad.id,
                title: ad.title,
                position: ad.position,
                media_type: ad.media_type,
                media_url: ad.media_url,
                target_url: ad.target_url,
                priority: ad.priority,
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
                  const ad = fileIdMap.get(fileInfo.fileID);
                  if (ad && fileInfo.code === "SUCCESS" && fileInfo.tempFileURL) {
                    ads.push({
                      id: ad._id || ad.id,
                      title: ad.title,
                      position: ad.position,
                      media_type: ad.media_type,
                      media_url: fileInfo.tempFileURL,
                      target_url: ad.target_url,
                      priority: ad.priority,
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
        console.error("CloudBase getActiveAds error:", err);
        return NextResponse.json(
          { success: false, error: "获取广告失败" },
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
          .from("advertisements")
          .select("id, title, position, media_type, media_url, target_url, priority")
          .eq("position", position)
          .eq("is_active", true)
          .order("priority", { ascending: false })
          .limit(10);

        if (error) {
          console.error("Supabase getActiveAds error:", error);
          return NextResponse.json(
            { success: false, error: "获取广告失败" },
            { status: 500 }
          );
        }

        if (data) {
          for (const ad of data) {
            ads.push({
              id: ad.id,
              title: ad.title,
              position: ad.position,
              media_type: ad.media_type,
              media_url: ad.media_url,
              target_url: ad.target_url,
              priority: ad.priority,
            });
          }
        }
      } catch (err) {
        console.error("Supabase getActiveAds exception:", err);
        return NextResponse.json(
          { success: false, error: "获取广告失败" },
          { status: 500 }
        );
      }
    }

    // 按优先级排序
    ads.sort((a, b) => b.priority - a.priority);

    return NextResponse.json({
      success: true,
      data: ads,
    });
  } catch (err) {
    console.error("getActiveAds error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "获取广告失败" },
      { status: 500 }
    );
  }
}
