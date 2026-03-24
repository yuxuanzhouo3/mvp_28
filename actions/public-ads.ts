"use server";

/**
 * 公开广告获取 Server Actions
 * 用于前端展示广告，不需要管理员权限
 * 根据 isDomestic 参数区分国内外版本
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";

// 广告类型定义（前端展示用）
export interface PublicAdvertisement {
  id: string;
  title: string;
  position: "top" | "bottom";
  media_type: "image" | "video";
  media_url: string;
  target_url: string | null;
  priority: number;
}

export interface GetAdsResult {
  success: boolean;
  error?: string;
  data?: PublicAdvertisement[];
}

/**
 * 获取活跃广告（按位置筛选）
 * @param position 广告位置：top（顶部）或 bottom（底部）
 * @param isDomestic 是否为国内版本（true: CloudBase, false: Supabase）
 */
export async function getActiveAds(
  position: "top" | "bottom",
  isDomestic: boolean
): Promise<GetAdsResult> {
  try {
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
              // 获取临时 URL 失败，跳过这些广告
            }
          }
        }
      } catch (err) {
        console.error("CloudBase getActiveAds error:", err);
        return {
          success: false,
          error: "获取广告失败",
        };
      }
    } else {
      // 国际版：从 Supabase 获取
      if (!supabaseAdmin) {
        return {
          success: false,
          error: "Supabase 未配置",
        };
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
          return {
            success: false,
            error: "获取广告失败",
          };
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
        return {
          success: false,
          error: "获取广告失败",
        };
      }
    }

    // 按优先级排序
    ads.sort((a, b) => b.priority - a.priority);

    return {
      success: true,
      data: ads,
    };
  } catch (err) {
    console.error("getActiveAds error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "获取广告失败",
    };
  }
}

/**
 * 获取所有活跃广告（顶部和底部）
 * @param isDomestic 是否为国内版本
 */
export async function getAllActiveAds(isDomestic: boolean): Promise<{
  success: boolean;
  error?: string;
  topAds?: PublicAdvertisement[];
  bottomAds?: PublicAdvertisement[];
}> {
  try {
    const [topResult, bottomResult] = await Promise.all([
      getActiveAds("top", isDomestic),
      getActiveAds("bottom", isDomestic),
    ]);

    if (!topResult.success && !bottomResult.success) {
      return {
        success: false,
        error: topResult.error || bottomResult.error || "获取广告失败",
      };
    }

    return {
      success: true,
      topAds: topResult.data || [],
      bottomAds: bottomResult.data || [],
    };
  } catch (err) {
    console.error("getAllActiveAds error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "获取广告失败",
    };
  }
}
