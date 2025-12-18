import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { IS_DOMESTIC_VERSION } from "@/config";

// 平台类型
type Platform = "ios" | "android" | "windows" | "macos" | "linux";

export interface PublicRelease {
  id: string;
  version: string;
  platform: Platform;
  variant?: string;
  file_url: string;
  file_size?: number;
  release_notes?: string;
}

// 有效的平台列表
const VALID_PLATFORMS: Platform[] = ["ios", "android", "windows", "macos", "linux"];

/**
 * GET /api/releases/active
 * 获取活跃发布版本（公开接口，无需认证）
 * Query params:
 *   - platform: "ios" | "android" | "windows" | "macos" | "linux" (可选，不传则返回所有)
 *   - isDomestic: "true" | "false"
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") as Platform | null;
    // 版本隔离：以部署版本为准，忽略客户端传参，避免跨库读取
    const isDomestic = IS_DOMESTIC_VERSION;

    // 验证平台参数（如果提供）
    if (platform && !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { success: false, error: "Invalid platform parameter" },
        { status: 400 }
      );
    }

    const releases: PublicRelease[] = [];

    if (isDomestic) {
      // 国内版：从 CloudBase 获取
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const app = connector.getApp();

        // 构建查询条件
        const whereCondition: Record<string, any> = { is_active: true };
        if (platform) {
          whereCondition.platform = platform;
        }

        const { data } = await db
          .collection("app_releases")
          .where(whereCondition)
          .orderBy("created_at", "desc")
          .limit(50)
          .get();

        if (data && Array.isArray(data)) {
          // 收集需要获取临时 URL 的 fileID
          const fileIdMap = new Map<string, any>();

          for (const release of data) {
            if (release.file_url && release.file_url.startsWith("cloud://")) {
              fileIdMap.set(release.file_url, release);
            } else {
              // 已经是临时 URL 或其他格式，直接使用
              releases.push({
                id: release._id || release.id,
                version: release.version,
                platform: release.platform,
                variant: release.variant,
                file_url: release.file_url,
                file_size: release.file_size,
                release_notes: release.release_notes,
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
                  const release = fileIdMap.get(fileInfo.fileID);
                  if (release && fileInfo.code === "SUCCESS" && fileInfo.tempFileURL) {
                    releases.push({
                      id: release._id || release.id,
                      version: release.version,
                      platform: release.platform,
                      variant: release.variant,
                      file_url: fileInfo.tempFileURL,
                      file_size: release.file_size,
                      release_notes: release.release_notes,
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
        console.error("CloudBase getActiveReleases error:", err);
        return NextResponse.json(
          { success: false, error: "获取发布版本失败" },
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
        let query = supabaseAdmin
          .from("app_releases")
          .select("id, version, platform, variant, file_url, file_size, release_notes")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(50);

        if (platform) {
          query = query.eq("platform", platform);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Supabase getActiveReleases error:", error);
          return NextResponse.json(
            { success: false, error: "获取发布版本失败" },
            { status: 500 }
          );
        }

        if (data) {
          for (const release of data) {
            releases.push({
              id: release.id,
              version: release.version,
              platform: release.platform,
              variant: release.variant,
              file_url: release.file_url,
              file_size: release.file_size,
              release_notes: release.release_notes,
            });
          }
        }
      } catch (err) {
        console.error("Supabase getActiveReleases exception:", err);
        return NextResponse.json(
          { success: false, error: "获取发布版本失败" },
          { status: 500 }
        );
      }
    }

    // 按平台和版本分组，每个平台+variant组合只返回最新的一个
    const latestByPlatformVariant = new Map<string, PublicRelease>();
    for (const release of releases) {
      const key = `${release.platform}-${release.variant || "default"}`;
      if (!latestByPlatformVariant.has(key)) {
        latestByPlatformVariant.set(key, release);
      }
    }

    return NextResponse.json({
      success: true,
      data: Array.from(latestByPlatformVariant.values()),
    });
  } catch (err) {
    console.error("getActiveReleases error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "获取发布版本失败" },
      { status: 500 }
    );
  }
}
