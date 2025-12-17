"use server";

/**
 * 广告管理 Server Actions
 * 实现双端同步：Supabase (国际版) + CloudBase (国内版)
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getAdminSession } from "@/utils/session";
import { revalidatePath } from "next/cache";

// 广告位置类型
export type AdPosition = "top" | "bottom" | "left" | "right" | "sidebar" | "bottom-left" | "bottom-right";

// 广告类型定义
export interface Advertisement {
  id: string;
  title: string;
  position: AdPosition;
  media_type: "image" | "video";
  media_url: string;
  target_url: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  source: "supabase" | "cloudbase" | "both"; // 数据来源
  file_size?: number; // 文件大小（字节）
}

export interface CreateAdResult {
  success: boolean;
  error?: string;
  data?: Advertisement;
}

export interface UpdateAdResult {
  success: boolean;
  error?: string;
}

export interface DeleteAdResult {
  success: boolean;
  error?: string;
}

export interface ListAdsResult {
  success: boolean;
  error?: string;
  data?: Advertisement[];
}

export interface StorageFile {
  name: string;
  url: string;
  size?: number;
  lastModified?: string;
  source: "supabase" | "cloudbase";
  fileId?: string; // CloudBase fileID，用于删除操作
  adId?: string; // 关联的广告 ID（CloudBase）
}

export interface ListFilesResult {
  success: boolean;
  error?: string;
  supabaseFiles?: StorageFile[];
  cloudbaseFiles?: StorageFile[];
}

/**
 * 验证管理员权限
 */
async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("未授权访问");
  }
  return session;
}

/**
 * 获取 CloudBase 客户端
 */
async function getCloudBase() {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  return {
    db: connector.getClient(),
    app: connector.getApp(),
  };
}

/**
 * 上传文件到 Supabase Storage
 */
async function uploadToSupabase(
  file: File,
  fileName: string
): Promise<string | null> {
  if (!supabaseAdmin) return null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${fileName}`;

    const { error } = await supabaseAdmin.storage
      .from("ads")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return null;
    }

    // 获取公开 URL
    const { data: urlData } = supabaseAdmin.storage
      .from("ads")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error("Supabase upload exception:", err);
    return null;
  }
}

/**
 * 上传文件到 CloudBase Storage
 * 返回 fileID（而不是临时 URL），便于后续获取新的临时 URL
 */
async function uploadToCloudBase(
  file: File,
  fileName: string
): Promise<string | null> {
  try {
    const { app } = await getCloudBase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const cloudPath = `ads/${fileName}`;

    console.log("CloudBase uploading to:", cloudPath);
    console.log("CloudBase env:", process.env.WECHAT_CLOUDBASE_ID);

    // Node SDK 使用 uploadFile 方法
    const uploadResult = await app.uploadFile({
      cloudPath,
      fileContent: buffer,
    });

    console.log("CloudBase upload result:", JSON.stringify(uploadResult, null, 2));

    if (!uploadResult.fileID) {
      console.error("CloudBase upload failed: no fileID returned");
      return null;
    }

    console.log("CloudBase upload success, fileID:", uploadResult.fileID);

    // 返回 fileID
    return uploadResult.fileID;
  } catch (err) {
    console.error("CloudBase upload exception:", err);
    return null;
  }
}

/**
 * 创建广告 - 支持选择上传目标
 * @param formData 包含 uploadTarget: "both" | "supabase" | "cloudbase"
 */
export async function createAdvertisement(
  formData: FormData
): Promise<CreateAdResult> {
  try {
    await requireAdmin();

    const title = formData.get("title") as string;
    const position = formData.get("position") as AdPosition;
    const mediaType = formData.get("mediaType") as "image" | "video";
    const targetUrl = formData.get("targetUrl") as string;
    const priority = parseInt(formData.get("priority") as string) || 0;
    const isActive = formData.get("isActive") === "true";
    const file = formData.get("file") as File;
    const uploadTarget = (formData.get("uploadTarget") as string) || "both";

    if (!title || !position || !mediaType) {
      return { success: false, error: "请填写必要字段" };
    }

    if (!file || file.size === 0) {
      return { success: false, error: "请上传媒体文件" };
    }

    // 生成唯一文件名
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // 根据选择上传到对应存储
    let supabaseUrl: string | null = null;
    let cloudbaseUrl: string | null = null;

    if (uploadTarget === "both" || uploadTarget === "supabase") {
      supabaseUrl = await uploadToSupabase(file, fileName);
      if (!supabaseUrl && (uploadTarget === "supabase" || uploadTarget === "both")) {
        return { success: false, error: "上传到 Supabase 失败" };
      }
    }

    if (uploadTarget === "both" || uploadTarget === "cloudbase") {
      cloudbaseUrl = await uploadToCloudBase(file, fileName);
      if (!cloudbaseUrl && uploadTarget === "cloudbase") {
        return { success: false, error: "上传到 CloudBase 失败" };
      }
    }

    // 生成 UUID
    const id = crypto.randomUUID();

    // 根据选择写入对应数据库
    const results: { supabase?: { error: unknown }; cloudbase?: { error: unknown } } = {};

    if ((uploadTarget === "both" || uploadTarget === "supabase") && supabaseUrl) {
      const supabaseResult = supabaseAdmin
        ? await supabaseAdmin.from("advertisements").insert({
            id,
            title,
            position,
            media_type: mediaType,
            media_url: supabaseUrl,
            target_url: targetUrl || null,
            is_active: isActive,
            priority,
            file_size: file.size, // 保存文件大小
          })
        : { error: new Error("Supabase not configured") };
      results.supabase = supabaseResult;

      if (supabaseResult.error) {
        console.error("Supabase insert error:", supabaseResult.error);
        if (uploadTarget === "supabase") {
          return { success: false, error: "保存到 Supabase 失败" };
        }
      }
    }

    if ((uploadTarget === "both" || uploadTarget === "cloudbase") && cloudbaseUrl) {
      try {
        const { db } = await getCloudBase();
        await db.collection("advertisements").add({
          _id: id,
          title,
          position,
          media_type: mediaType,
          media_url: cloudbaseUrl,
          target_url: targetUrl || null,
          is_active: isActive,
          priority,
          created_at: new Date().toISOString(),
          file_size: file.size, // 保存文件大小
        });
        results.cloudbase = { error: null };
      } catch (err) {
        console.error("CloudBase insert error:", err);
        results.cloudbase = { error: err };
        if (uploadTarget === "cloudbase") {
          return { success: false, error: "保存到 CloudBase 失败" };
        }
      }
    }

    // 检查是否至少有一个成功
    const supabaseSuccess = !results.supabase?.error;
    const cloudbaseSuccess = !results.cloudbase?.error;

    if (uploadTarget === "both" && !supabaseSuccess && !cloudbaseSuccess) {
      return { success: false, error: "保存到数据库失败" };
    }

    revalidatePath("/admin/ads");

    // 确定数据源
    let source: "supabase" | "cloudbase" | "both" = "both";
    if (uploadTarget === "supabase") {
      source = "supabase";
    } else if (uploadTarget === "cloudbase") {
      source = "cloudbase";
    }

    return {
      success: true,
      data: {
        id,
        title,
        position,
        media_type: mediaType,
        media_url: supabaseUrl || cloudbaseUrl || "",
        target_url: targetUrl || null,
        is_active: isActive,
        priority,
        created_at: new Date().toISOString(),
        source,
        file_size: file.size,
      },
    };
  } catch (err) {
    console.error("Create advertisement error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "创建广告失败",
    };
  }
}

/**
 * 获取广告列表（合并 Supabase 和 CloudBase）
 */
export async function listAdvertisements(): Promise<ListAdsResult> {
  try {
    await requireAdmin();

    const adsMap = new Map<string, Advertisement>();

    // 从 Supabase 获取
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from("advertisements")
          .select("*")
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false });

        if (!error && data) {
          // 先获取 Storage 中的文件列表以获取文件大小
          let storageFiles: { name: string; metadata?: { size?: number } }[] = [];
          try {
            const { data: files } = await supabaseAdmin.storage
              .from("ads")
              .list("", { limit: 1000 });
            storageFiles = files || [];
          } catch (storageErr) {
            console.warn("Get storage files warning:", storageErr);
          }

          // 创建文件名到大小的映射
          const fileSizeMap = new Map<string, number>();
          for (const file of storageFiles) {
            if (file.metadata?.size) {
              fileSizeMap.set(file.name, file.metadata.size);
            }
          }

          for (const ad of data) {
            let fileSize = ad.file_size;

            // 如果数据库中没有 file_size，尝试从 Storage 文件列表获取
            if (!fileSize && ad.media_url) {
              try {
                // 从 URL 提取文件名
                const urlParts = ad.media_url.split("/ads/");
                if (urlParts.length > 1) {
                  const fileName = decodeURIComponent(urlParts[1].split("?")[0]);
                  fileSize = fileSizeMap.get(fileName);
                }
              } catch {
                // 忽略解析错误
              }
            }

            adsMap.set(ad.id, {
              ...ad,
              file_size: fileSize,
              source: "supabase" as const,
            });
          }
        }
      } catch (err) {
        console.warn("Supabase list warning:", err);
      }
    }

    // 从 CloudBase 获取
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const app = connector.getApp();

      const { data } = await db
        .collection("advertisements")
        .orderBy("priority", "desc")
        .orderBy("created_at", "desc")
        .get();

      console.log("CloudBase ads list count:", data?.length || 0);

      if (data && Array.isArray(data)) {
        // 收集需要获取临时 URL 的 fileID
        const cloudbaseAds: { ad: any; fileId: string }[] = [];

        for (const ad of data) {
          const id = ad._id || ad.id;
          let fileId: string | null = null;

          // 检查 media_url 是否是 fileID 格式
          if (ad.media_url && ad.media_url.startsWith("cloud://")) {
            fileId = ad.media_url;
            console.log(`Ad ${id} has fileID format: ${fileId}`);
          } else {
            console.log(`Ad ${id} has URL format: ${ad.media_url}`);
          }

          if (adsMap.has(id)) {
            // 两边都有，标记为 both
            const existing = adsMap.get(id)!;
            adsMap.set(id, { ...existing, source: "both" });
          } else {
            // 只在 CloudBase 有，暂时使用原 URL
            adsMap.set(id, {
              id,
              title: ad.title,
              position: ad.position,
              media_type: ad.media_type,
              media_url: ad.media_url,
              target_url: ad.target_url,
              is_active: ad.is_active,
              priority: ad.priority,
              created_at: ad.created_at,
              source: "cloudbase" as const,
              file_size: ad.file_size,
            });

            if (fileId) {
              cloudbaseAds.push({ ad: { ...ad, id }, fileId });
            }
          }
        }

        // 批量获取 CloudBase 文件的临时 URL
        if (cloudbaseAds.length > 0) {
          console.log("Getting temp URLs for", cloudbaseAds.length, "CloudBase files");
          try {
            const fileIds = cloudbaseAds.map((item) => item.fileId);
            const urlResult = await app.getTempFileURL({
              fileList: fileIds,
            });

            console.log("getTempFileURL result:", JSON.stringify(urlResult, null, 2));

            if (urlResult.fileList && Array.isArray(urlResult.fileList)) {
              // 创建 fileID -> tempURL 映射
              const urlMap = new Map<string, string>();
              for (const fileInfo of urlResult.fileList) {
                // CloudBase Node SDK 返回 code: "SUCCESS" 表示成功，而不是 status === 0
                if (fileInfo.tempFileURL && fileInfo.code === "SUCCESS") {
                  urlMap.set(fileInfo.fileID, fileInfo.tempFileURL);
                  console.log(`Got temp URL for ${fileInfo.fileID}`);
                } else {
                  console.log(`Failed to get temp URL for ${fileInfo.fileID}, code: ${fileInfo.code}`);
                }
              }

              // 更新 adsMap 中的 media_url
              for (const { ad, fileId } of cloudbaseAds) {
                const tempUrl = urlMap.get(fileId);
                if (tempUrl) {
                  const existing = adsMap.get(ad.id);
                  if (existing) {
                    adsMap.set(ad.id, { ...existing, media_url: tempUrl });
                  }
                }
              }
            }
          } catch (urlErr) {
            console.error("CloudBase getTempFileURL error:", urlErr);
            // 获取失败，保持原 URL
          }
        }
      }
    } catch (err) {
      console.error("CloudBase list error:", err);
    }

    // 转换为数组并排序
    const ads = Array.from(adsMap.values()).sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return { success: true, data: ads };
  } catch (err) {
    console.error("List advertisements error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "获取广告列表失败",
    };
  }
}

/**
 * 更新广告 - 双端同步
 */
export async function updateAdvertisement(
  id: string,
  formData: FormData
): Promise<UpdateAdResult> {
  try {
    await requireAdmin();

    const title = formData.get("title") as string;
    const targetUrl = formData.get("targetUrl") as string;
    const priority = parseInt(formData.get("priority") as string) || 0;
    const isActive = formData.get("isActive") === "true";

    const updates = {
      title,
      target_url: targetUrl || null,
      priority,
      is_active: isActive,
    };

    // 并发更新两个数据库
    const supabasePromise = supabaseAdmin
      ? supabaseAdmin.from("advertisements").update(updates).eq("id", id)
      : Promise.resolve({ error: new Error("Supabase not configured") });

    const cloudbasePromise = (async () => {
      try {
        const { db } = await getCloudBase();
        await db.collection("advertisements").doc(id).update(updates);
        return { error: null };
      } catch (err) {
        return { error: err };
      }
    })();

    const [supabaseResult, cloudbaseResult] = await Promise.all([
      supabasePromise,
      cloudbasePromise,
    ]);

    if (supabaseResult.error) {
      console.error("Supabase update error:", supabaseResult.error);
      return { success: false, error: "更新失败" };
    }

    if (cloudbaseResult.error) {
      console.warn("CloudBase update warning:", cloudbaseResult.error);
    }

    revalidatePath("/admin/ads");

    return { success: true };
  } catch (err) {
    console.error("Update advertisement error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "更新广告失败",
    };
  }
}

/**
 * 切换广告状态（上架/下架）- 双端同步
 */
export async function toggleAdvertisementStatus(
  id: string,
  isActive: boolean
): Promise<UpdateAdResult> {
  try {
    await requireAdmin();

    // 并发更新两个数据库
    const supabasePromise = supabaseAdmin
      ? supabaseAdmin
          .from("advertisements")
          .update({ is_active: isActive })
          .eq("id", id)
      : Promise.resolve({ error: new Error("Supabase not configured") });

    const cloudbasePromise = (async () => {
      try {
        const { db } = await getCloudBase();
        await db.collection("advertisements").doc(id).update({ is_active: isActive });
        return { error: null };
      } catch (err) {
        return { error: err };
      }
    })();

    const [supabaseResult, cloudbaseResult] = await Promise.all([
      supabasePromise,
      cloudbasePromise,
    ]);

    if (supabaseResult.error) {
      console.error("Supabase toggle error:", supabaseResult.error);
      return { success: false, error: "切换状态失败" };
    }

    if (cloudbaseResult.error) {
      console.warn("CloudBase toggle warning:", cloudbaseResult.error);
    }

    revalidatePath("/admin/ads");

    return { success: true };
  } catch (err) {
    console.error("Toggle advertisement error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "切换状态失败",
    };
  }
}

/**
 * 删除广告 - 双端同步（硬删除）
 */
export async function deleteAdvertisement(id: string): Promise<DeleteAdResult> {
  try {
    await requireAdmin();

    // 先获取广告信息以便删除存储文件
    let mediaUrl: string | null = null;
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from("advertisements")
        .select("media_url")
        .eq("id", id)
        .single();
      mediaUrl = data?.media_url;
    }

    // 并发删除两个数据库的记录
    const supabasePromise = supabaseAdmin
      ? supabaseAdmin.from("advertisements").delete().eq("id", id)
      : Promise.resolve({ error: new Error("Supabase not configured") });

    const cloudbasePromise = (async () => {
      try {
        const { db } = await getCloudBase();
        await db.collection("advertisements").doc(id).remove();
        return { error: null };
      } catch (err) {
        return { error: err };
      }
    })();

    const [supabaseResult, cloudbaseResult] = await Promise.all([
      supabasePromise,
      cloudbasePromise,
    ]);

    if (supabaseResult.error) {
      console.error("Supabase delete error:", supabaseResult.error);
      return { success: false, error: "删除失败" };
    }

    if (cloudbaseResult.error) {
      console.warn("CloudBase delete warning:", cloudbaseResult.error);
    }

    // 尝试删除存储文件（可选，不影响主流程）
    if (mediaUrl && supabaseAdmin) {
      try {
        // 从 URL 提取文件路径
        const urlParts = mediaUrl.split("/ads/");
        if (urlParts.length > 1) {
          const fileName = urlParts[1].split("?")[0];
          await supabaseAdmin.storage.from("ads").remove([fileName]);
        }
      } catch (err) {
        console.warn("Delete storage file warning:", err);
      }
    }

    revalidatePath("/admin/ads");

    return { success: true };
  } catch (err) {
    console.error("Delete advertisement error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "删除广告失败",
    };
  }
}

/**
 * 列出存储文件 - 两个云存储
 */
export async function listStorageFiles(): Promise<ListFilesResult> {
  try {
    await requireAdmin();

    const supabaseFiles: StorageFile[] = [];
    const cloudbaseFiles: StorageFile[] = [];

    // 获取 Supabase Storage 文件
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from("ads")
          .list("", { limit: 100 });

        if (!error && data) {
          for (const file of data) {
            const { data: urlData } = supabaseAdmin.storage
              .from("ads")
              .getPublicUrl(file.name);

            supabaseFiles.push({
              name: file.name,
              url: urlData.publicUrl,
              size: file.metadata?.size,
              lastModified: file.updated_at,
              source: "supabase",
            });
          }
        }
      } catch (err) {
        console.warn("List Supabase files warning:", err);
      }
    }

    // 获取 CloudBase Storage 文件
    try {
      // 从数据库获取广告记录
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const app = connector.getApp();

      const { data } = await db.collection("advertisements").get();

      console.log("CloudBase advertisements count:", data?.length || 0);

      if (data && Array.isArray(data)) {
        // 收集所有 fileID（仅处理 cloud:// 格式的）
        const fileIdList: string[] = [];
        const adMap: Map<string, { ad: any; fileName: string }> = new Map();

        for (const ad of data) {
          if (ad.media_url) {
            console.log("Processing ad media_url:", ad.media_url);

            let fileId: string | null = null;
            let fileName: string;

            if (ad.media_url.startsWith("cloud://")) {
              // 已经是 fileID 格式（新上传的文件）
              fileId = ad.media_url;
              // 从 fileID 提取文件名: cloud://env.xxx/ads/filename.ext
              const pathParts = ad.media_url.split("/");
              fileName = pathParts[pathParts.length - 1] || ad._id;
            } else {
              // 旧的临时 URL 格式，直接使用原 URL 显示
              const urlParts = ad.media_url.split("/");
              fileName = urlParts[urlParts.length - 1]?.split("?")[0] || ad._id;

              // 对于旧 URL，直接添加到结果（不尝试获取新临时 URL）
              cloudbaseFiles.push({
                name: fileName,
                url: ad.media_url,
                size: ad.file_size, // 从广告记录获取文件大小
                lastModified: ad.created_at, // 使用创建时间作为修改时间
                source: "cloudbase",
                fileId: undefined,
                adId: ad._id || ad.id,
              });
              continue; // 跳过 fileID 处理
            }

            if (fileId) {
              fileIdList.push(fileId);
              adMap.set(fileId, { ad, fileName });
            }
          }
        }

        console.log("CloudBase fileIdList:", fileIdList);

        // 批量获取临时访问 URL（仅处理 cloud:// 格式的）
        if (fileIdList.length > 0) {
          try {
            const urlResult = await app.getTempFileURL({
              fileList: fileIdList,
            });

            console.log("CloudBase getTempFileURL result:", JSON.stringify(urlResult, null, 2));

            if (urlResult.fileList && Array.isArray(urlResult.fileList)) {
              for (const fileInfo of urlResult.fileList) {
                console.log("Processing fileInfo:", fileInfo);

                // 查找对应的广告记录
                const mapEntry = adMap.get(fileInfo.fileID);
                if (mapEntry) {
                  const { ad, fileName } = mapEntry;
                  // CloudBase Node SDK 返回 code: "SUCCESS" 表示成功
                  const isSuccess = fileInfo.code === "SUCCESS" && fileInfo.tempFileURL;
                  const displayUrl = isSuccess ? fileInfo.tempFileURL : ad.media_url;

                  console.log(`File ${fileName}: code=${fileInfo.code}, url=${displayUrl}`);

                  cloudbaseFiles.push({
                    name: fileName,
                    url: displayUrl,
                    size: ad.file_size, // 从广告记录获取文件大小
                    lastModified: ad.created_at, // 使用创建时间作为修改时间
                    source: "cloudbase",
                    fileId: fileInfo.fileID,
                    adId: ad._id || ad.id,
                  });

                  // 从 map 中移除已处理的
                  adMap.delete(fileInfo.fileID);
                }
              }
            }

            // 处理未能获取临时 URL 的文件（可能 fileID 不匹配）
            for (const [fileId, { ad, fileName }] of adMap) {
              console.log(`File ${fileName} not found in result, using original URL`);
              cloudbaseFiles.push({
                name: fileName,
                url: ad.media_url, // 使用原 URL
                size: ad.file_size, // 从广告记录获取文件大小
                lastModified: ad.created_at, // 使用创建时间作为修改时间
                source: "cloudbase",
                fileId: fileId,
                adId: ad._id || ad.id,
              });
            }
          } catch (urlErr) {
            console.error("CloudBase getTempFileURL error:", urlErr);
            // 如果批量获取失败，使用原 URL
            for (const [fileId, { ad, fileName }] of adMap) {
              cloudbaseFiles.push({
                name: fileName,
                url: ad.media_url,
                size: ad.file_size, // 从广告记录获取文件大小
                lastModified: ad.created_at, // 使用创建时间作为修改时间
                source: "cloudbase",
                fileId: fileId,
                adId: ad._id || ad.id,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("List CloudBase files error:", err);
    }

    return {
      success: true,
      supabaseFiles,
      cloudbaseFiles,
    };
  } catch (err) {
    console.error("List storage files error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "获取文件列表失败",
    };
  }
}

export interface FileOperationResult {
  success: boolean;
  error?: string;
}

/**
 * 删除存储文件
 * @param fileName 文件名或 fileId
 * @param source 数据源
 * @param fileId CloudBase 的 fileID（可选）
 * @param adId 关联的广告 ID（可选，用于删除 CloudBase 广告记录）
 */
export async function deleteStorageFile(
  fileName: string,
  source: "supabase" | "cloudbase",
  fileId?: string,
  adId?: string
): Promise<FileOperationResult> {
  try {
    await requireAdmin();

    if (source === "supabase") {
      if (!supabaseAdmin) {
        return { success: false, error: "Supabase 未配置" };
      }

      const { error } = await supabaseAdmin.storage
        .from("ads")
        .remove([fileName]);

      if (error) {
        console.error("Supabase delete file error:", error);
        return { success: false, error: "删除文件失败" };
      }
    } else if (source === "cloudbase") {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const app = connector.getApp();

        // 如果提供了 adId，先删除广告记录
        if (adId) {
          try {
            await db.collection("advertisements").doc(adId).remove();
            console.log("CloudBase ad record deleted:", adId);
          } catch (dbErr) {
            console.warn("CloudBase delete ad record warning:", dbErr);
          }
        }

        // 尝试删除存储文件（仅当有有效的 fileId 时）
        if (fileId && fileId.startsWith("cloud://")) {
          try {
            await app.deleteFile({ fileList: [fileId] });
            console.log("CloudBase file deleted:", fileId);
          } catch (fileErr) {
            // 文件删除失败不影响整体操作，因为广告记录可能已删除
            console.warn("CloudBase delete file warning:", fileErr);
          }
        } else {
          console.log("No valid CloudBase fileId provided, skipping file deletion");
        }
      } catch (err) {
        console.error("CloudBase delete error:", err);
        return { success: false, error: "删除 CloudBase 文件失败" };
      }
    }

    revalidatePath("/admin/files");
    revalidatePath("/admin/ads");
    return { success: true };
  } catch (err) {
    console.error("Delete storage file error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "删除文件失败",
    };
  }
}

/**
 * 重命名存储文件（Supabase）
 * 注意：Supabase 不支持直接重命名，需要复制后删除原文件
 */
export async function renameStorageFile(
  oldName: string,
  newName: string,
  source: "supabase" | "cloudbase"
): Promise<FileOperationResult> {
  try {
    await requireAdmin();

    if (source === "supabase") {
      if (!supabaseAdmin) {
        return { success: false, error: "Supabase 未配置" };
      }

      // 下载原文件
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from("ads")
        .download(oldName);

      if (downloadError || !fileData) {
        console.error("Supabase download error:", downloadError);
        return { success: false, error: "下载原文件失败" };
      }

      // 上传为新文件名
      const buffer = Buffer.from(await fileData.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage
        .from("ads")
        .upload(newName, buffer, {
          contentType: fileData.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return { success: false, error: "上传新文件失败" };
      }

      // 删除原文件
      const { error: deleteError } = await supabaseAdmin.storage
        .from("ads")
        .remove([oldName]);

      if (deleteError) {
        console.warn("Supabase delete old file warning:", deleteError);
        // 不返回错误，因为新文件已创建成功
      }

      // 更新数据库中引用该文件的广告记录
      const { data: urlData } = supabaseAdmin.storage
        .from("ads")
        .getPublicUrl(newName);

      const oldUrl = supabaseAdmin.storage.from("ads").getPublicUrl(oldName).data.publicUrl;

      await supabaseAdmin
        .from("advertisements")
        .update({ media_url: urlData.publicUrl })
        .eq("media_url", oldUrl);

    } else if (source === "cloudbase") {
      // CloudBase 重命名：下载原文件 -> 上传新文件名 -> 删除原文件 -> 更新数据库记录
      return { success: false, error: "CloudBase 暂不支持重命名文件（需要提供 fileId 和 adId）" };
    }

    revalidatePath("/admin/files");
    revalidatePath("/admin/ads");
    return { success: true };
  } catch (err) {
    console.error("Rename storage file error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "重命名文件失败",
    };
  }
}

/**
 * CloudBase 文件重命名（需要 fileId 和 adId）
 * 实现方式：下载原文件 -> 上传新文件名 -> 删除原文件 -> 更新数据库记录
 */
export async function renameCloudBaseFile(
  oldName: string,
  newName: string,
  fileId: string,
  adId: string
): Promise<FileOperationResult> {
  try {
    await requireAdmin();

    if (!fileId || !fileId.startsWith("cloud://")) {
      return { success: false, error: "无效的 CloudBase fileId" };
    }

    const connector = new CloudBaseConnector();
    await connector.initialize();
    const db = connector.getClient();
    const app = connector.getApp();

    // 1. 下载原文件
    console.log("CloudBase rename: downloading file", fileId);
    const downloadResult = await app.downloadFile({
      fileID: fileId,
    });

    if (!downloadResult.fileContent) {
      console.error("CloudBase download failed: no fileContent");
      return { success: false, error: "下载原文件失败" };
    }

    // 2. 上传为新文件名
    const newCloudPath = `ads/${newName}`;
    console.log("CloudBase rename: uploading to", newCloudPath);
    const uploadResult = await app.uploadFile({
      cloudPath: newCloudPath,
      fileContent: downloadResult.fileContent,
    });

    if (!uploadResult.fileID) {
      console.error("CloudBase upload failed: no fileID returned");
      return { success: false, error: "上传新文件失败" };
    }

    console.log("CloudBase rename: new fileID", uploadResult.fileID);

    // 3. 更新数据库记录
    try {
      await db.collection("advertisements").doc(adId).update({
        media_url: uploadResult.fileID,
      });
      console.log("CloudBase rename: database updated");
    } catch (dbErr) {
      console.error("CloudBase rename: database update failed", dbErr);
      // 尝试删除新上传的文件
      try {
        await app.deleteFile({ fileList: [uploadResult.fileID] });
      } catch {}
      return { success: false, error: "更新数据库记录失败" };
    }

    // 4. 删除原文件
    try {
      await app.deleteFile({ fileList: [fileId] });
      console.log("CloudBase rename: old file deleted");
    } catch (deleteErr) {
      // 删除失败不影响整体操作，因为新文件已创建并且数据库已更新
      console.warn("CloudBase rename: delete old file warning", deleteErr);
    }

    revalidatePath("/admin/files");
    revalidatePath("/admin/ads");
    return { success: true };
  } catch (err) {
    console.error("CloudBase rename error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "重命名文件失败",
    };
  }
}

export interface DownloadResult {
  success: boolean;
  error?: string;
  data?: string; // Base64 编码的文件内容
  contentType?: string;
  fileName?: string;
}

/**
 * 下载存储文件
 * 返回 Base64 编码的文件内容，前端可以直接下载
 */
export async function downloadStorageFile(
  fileName: string,
  source: "supabase" | "cloudbase",
  fileId?: string
): Promise<DownloadResult> {
  try {
    await requireAdmin();

    if (source === "supabase") {
      if (!supabaseAdmin) {
        return { success: false, error: "Supabase 未配置" };
      }

      const { data, error } = await supabaseAdmin.storage
        .from("ads")
        .download(fileName);

      if (error || !data) {
        console.error("Supabase download error:", error);
        return { success: false, error: "下载文件失败" };
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      return {
        success: true,
        data: buffer.toString("base64"),
        contentType: data.type,
        fileName,
      };
    } else if (source === "cloudbase") {
      if (!fileId || !fileId.startsWith("cloud://")) {
        return { success: false, error: "无效的 CloudBase fileId" };
      }

      const connector = new CloudBaseConnector();
      await connector.initialize();
      const app = connector.getApp();

      const downloadResult = await app.downloadFile({
        fileID: fileId,
      });

      if (!downloadResult.fileContent) {
        console.error("CloudBase download failed: no fileContent");
        return { success: false, error: "下载文件失败" };
      }

      // fileContent 是 Buffer
      const buffer = Buffer.from(downloadResult.fileContent);

      // 根据文件扩展名推断 contentType
      const ext = fileName.split(".").pop()?.toLowerCase();
      let contentType = "application/octet-stream";
      if (ext) {
        const mimeTypes: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
          svg: "image/svg+xml",
          mp4: "video/mp4",
          webm: "video/webm",
          mov: "video/quicktime",
          avi: "video/x-msvideo",
        };
        contentType = mimeTypes[ext] || contentType;
      }

      return {
        success: true,
        data: buffer.toString("base64"),
        contentType,
        fileName,
      };
    }

    return { success: false, error: "不支持的数据源" };
  } catch (err) {
    console.error("Download storage file error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "下载文件失败",
    };
  }
}
