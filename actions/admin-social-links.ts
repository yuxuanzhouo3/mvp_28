"use server";

/**
 * 社交链接管理 Server Actions
 * 实现双端同步：Supabase (国际版) + CloudBase (国内版)
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getAdminSession } from "@/utils/session";
import { revalidatePath } from "next/cache";

// 社交链接类型定义
export interface SocialLink {
  id: string;
  title: string;
  description: string | null;
  icon_url: string;
  target_url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string;
  source: "supabase" | "cloudbase" | "both";
  file_size?: number;
}

export interface CreateSocialLinkResult {
  success: boolean;
  error?: string;
  data?: SocialLink;
}

export interface UpdateSocialLinkResult {
  success: boolean;
  error?: string;
}

export interface DeleteSocialLinkResult {
  success: boolean;
  error?: string;
}

export interface ListSocialLinksResult {
  success: boolean;
  error?: string;
  data?: SocialLink[];
}

export interface SocialLinkFile {
  name: string;
  url: string;
  size?: number;
  lastModified?: string;
  source: "supabase" | "cloudbase";
  fileId?: string;
  linkId?: string;
}

export interface ListSocialLinkFilesResult {
  success: boolean;
  error?: string;
  supabaseFiles?: SocialLinkFile[];
  cloudbaseFiles?: SocialLinkFile[];
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
 * 上传图标到 Supabase Storage
 */
async function uploadIconToSupabase(
  file: File,
  fileName: string
): Promise<string | null> {
  if (!supabaseAdmin) return null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${fileName}`;

    const { error } = await supabaseAdmin.storage
      .from("social-icons")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Supabase upload icon error:", error);
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("social-icons")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error("Supabase upload icon exception:", err);
    return null;
  }
}

/**
 * 上传图标到 CloudBase Storage
 */
async function uploadIconToCloudBase(
  file: File,
  fileName: string
): Promise<string | null> {
  try {
    const { app } = await getCloudBase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const cloudPath = `social-icons/${fileName}`;

    const uploadResult = await app.uploadFile({
      cloudPath,
      fileContent: buffer,
    });

    if (!uploadResult.fileID) {
      console.error("CloudBase upload icon failed: no fileID returned");
      return null;
    }

    return uploadResult.fileID;
  } catch (err) {
    console.error("CloudBase upload icon exception:", err);
    return null;
  }
}

/**
 * 创建社交链接
 */
export async function createSocialLink(
  formData: FormData
): Promise<CreateSocialLinkResult> {
  try {
    await requireAdmin();

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const targetUrl = formData.get("targetUrl") as string;
    const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
    const isActive = formData.get("isActive") === "true";
    const file = formData.get("file") as File;
    const uploadTarget = (formData.get("uploadTarget") as string) || "both";

    if (!title || !targetUrl) {
      return { success: false, error: "请填写标题和链接" };
    }

    if (!file || file.size === 0) {
      return { success: false, error: "请上传图标文件" };
    }

    // 生成唯一文件名
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // 根据选择上传到对应存储
    let supabaseUrl: string | null = null;
    let cloudbaseUrl: string | null = null;

    if (uploadTarget === "both" || uploadTarget === "supabase") {
      supabaseUrl = await uploadIconToSupabase(file, fileName);
      if (!supabaseUrl && (uploadTarget === "supabase" || uploadTarget === "both")) {
        return { success: false, error: "上传到 Supabase 失败" };
      }
    }

    if (uploadTarget === "both" || uploadTarget === "cloudbase") {
      cloudbaseUrl = await uploadIconToCloudBase(file, fileName);
      if (!cloudbaseUrl && uploadTarget === "cloudbase") {
        return { success: false, error: "上传到 CloudBase 失败" };
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const results: { supabase?: { error: unknown }; cloudbase?: { error: unknown } } = {};

    if ((uploadTarget === "both" || uploadTarget === "supabase") && supabaseUrl) {
      const supabaseResult = supabaseAdmin
        ? await supabaseAdmin.from("social_links").insert({
            id,
            title,
            description: description || null,
            icon_url: supabaseUrl,
            target_url: targetUrl,
            is_active: isActive,
            sort_order: sortOrder,
            file_size: file.size,
          })
        : { error: new Error("Supabase not configured") };
      results.supabase = supabaseResult;

      if (supabaseResult.error) {
        console.error("Supabase insert social link error:", supabaseResult.error);
        if (uploadTarget === "supabase") {
          return { success: false, error: "保存到 Supabase 失败" };
        }
      }
    }

    if ((uploadTarget === "both" || uploadTarget === "cloudbase") && cloudbaseUrl) {
      try {
        const { db } = await getCloudBase();
        await db.collection("social_links").add({
          _id: id,
          title,
          description: description || null,
          icon_url: cloudbaseUrl,
          target_url: targetUrl,
          is_active: isActive,
          sort_order: sortOrder,
          created_at: now,
          updated_at: now,
          file_size: file.size,
        });
        results.cloudbase = { error: null };
      } catch (err) {
        console.error("CloudBase insert social link error:", err);
        results.cloudbase = { error: err };
        if (uploadTarget === "cloudbase") {
          return { success: false, error: "保存到 CloudBase 失败" };
        }
      }
    }

    const supabaseSuccess = !results.supabase?.error;
    const cloudbaseSuccess = !results.cloudbase?.error;

    if (uploadTarget === "both" && !supabaseSuccess && !cloudbaseSuccess) {
      return { success: false, error: "保存到数据库失败" };
    }

    revalidatePath("/admin/social-links");

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
        description: description || null,
        icon_url: supabaseUrl || cloudbaseUrl || "",
        target_url: targetUrl,
        is_active: isActive,
        sort_order: sortOrder,
        created_at: now,
        source,
        file_size: file.size,
      },
    };
  } catch (err) {
    console.error("Create social link error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "创建社交链接失败",
    };
  }
}

/**
 * 获取社交链接列表
 */
export async function listSocialLinks(): Promise<ListSocialLinksResult> {
  try {
    await requireAdmin();

    const linksMap = new Map<string, SocialLink>();

    // 从 Supabase 获取
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from("social_links")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });

        if (!error && data) {
          for (const link of data) {
            linksMap.set(link.id, {
              ...link,
              source: "supabase" as const,
            });
          }
        }
      } catch (err) {
        console.warn("Supabase list social links warning:", err);
      }
    }

    // 从 CloudBase 获取
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const app = connector.getApp();

      const { data } = await db
        .collection("social_links")
        .orderBy("sort_order", "asc")
        .orderBy("created_at", "desc")
        .get();

      if (data && Array.isArray(data)) {
        const cloudbaseLinks: { link: any; fileId: string }[] = [];

        for (const link of data) {
          const id = link._id || link.id;
          let fileId: string | null = null;

          if (link.icon_url && link.icon_url.startsWith("cloud://")) {
            fileId = link.icon_url;
          }

          if (linksMap.has(id)) {
            const existing = linksMap.get(id)!;
            linksMap.set(id, { ...existing, source: "both" });
          } else {
            linksMap.set(id, {
              id,
              title: link.title,
              description: link.description,
              icon_url: link.icon_url,
              target_url: link.target_url,
              is_active: link.is_active,
              sort_order: link.sort_order,
              created_at: link.created_at,
              updated_at: link.updated_at,
              source: "cloudbase" as const,
              file_size: link.file_size,
            });

            if (fileId) {
              cloudbaseLinks.push({ link: { ...link, id }, fileId });
            }
          }
        }

        // 批量获取临时 URL
        if (cloudbaseLinks.length > 0) {
          try {
            const fileIds = cloudbaseLinks.map((item) => item.fileId);
            const urlResult = await app.getTempFileURL({
              fileList: fileIds,
            });

            if (urlResult.fileList && Array.isArray(urlResult.fileList)) {
              const urlMap = new Map<string, string>();
              for (const fileInfo of urlResult.fileList) {
                if (fileInfo.tempFileURL && fileInfo.code === "SUCCESS") {
                  urlMap.set(fileInfo.fileID, fileInfo.tempFileURL);
                }
              }

              for (const { link, fileId } of cloudbaseLinks) {
                const tempUrl = urlMap.get(fileId);
                if (tempUrl) {
                  const existing = linksMap.get(link.id);
                  if (existing) {
                    linksMap.set(link.id, { ...existing, icon_url: tempUrl });
                  }
                }
              }
            }
          } catch (urlErr) {
            console.error("CloudBase getTempFileURL error:", urlErr);
          }
        }
      }
    } catch (err) {
      console.error("CloudBase list social links error:", err);
    }

    const links = Array.from(linksMap.values()).sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return { success: true, data: links };
  } catch (err) {
    console.error("List social links error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "获取社交链接列表失败",
    };
  }
}

/**
 * 更新社交链接
 */
export async function updateSocialLink(
  id: string,
  formData: FormData
): Promise<UpdateSocialLinkResult> {
  try {
    await requireAdmin();

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const targetUrl = formData.get("targetUrl") as string;
    const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
    const isActive = formData.get("isActive") === "true";

    const updates = {
      title,
      description: description || null,
      target_url: targetUrl,
      sort_order: sortOrder,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    const supabasePromise = supabaseAdmin
      ? supabaseAdmin.from("social_links").update(updates).eq("id", id)
      : Promise.resolve({ error: new Error("Supabase not configured") });

    const cloudbasePromise = (async () => {
      try {
        const { db } = await getCloudBase();
        await db.collection("social_links").doc(id).update(updates);
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
      console.error("Supabase update social link error:", supabaseResult.error);
      return { success: false, error: "更新失败" };
    }

    if (cloudbaseResult.error) {
      console.warn("CloudBase update social link warning:", cloudbaseResult.error);
    }

    revalidatePath("/admin/social-links");

    return { success: true };
  } catch (err) {
    console.error("Update social link error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "更新社交链接失败",
    };
  }
}

/**
 * 切换社交链接状态
 */
export async function toggleSocialLinkStatus(
  id: string,
  isActive: boolean
): Promise<UpdateSocialLinkResult> {
  try {
    await requireAdmin();

    const updates = {
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    const supabasePromise = supabaseAdmin
      ? supabaseAdmin.from("social_links").update(updates).eq("id", id)
      : Promise.resolve({ error: new Error("Supabase not configured") });

    const cloudbasePromise = (async () => {
      try {
        const { db } = await getCloudBase();
        await db.collection("social_links").doc(id).update(updates);
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
      console.error("Supabase toggle social link error:", supabaseResult.error);
      return { success: false, error: "切换状态失败" };
    }

    if (cloudbaseResult.error) {
      console.warn("CloudBase toggle social link warning:", cloudbaseResult.error);
    }

    revalidatePath("/admin/social-links");

    return { success: true };
  } catch (err) {
    console.error("Toggle social link error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "切换状态失败",
    };
  }
}

/**
 * 删除社交链接
 */
export async function deleteSocialLink(id: string): Promise<DeleteSocialLinkResult> {
  try {
    await requireAdmin();

    // 获取图标 URL 以便删除存储文件
    let iconUrl: string | null = null;
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from("social_links")
        .select("icon_url")
        .eq("id", id)
        .single();
      iconUrl = data?.icon_url;
    }

    const supabasePromise = supabaseAdmin
      ? supabaseAdmin.from("social_links").delete().eq("id", id)
      : Promise.resolve({ error: new Error("Supabase not configured") });

    const cloudbasePromise = (async () => {
      try {
        const { db } = await getCloudBase();
        await db.collection("social_links").doc(id).remove();
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
      console.error("Supabase delete social link error:", supabaseResult.error);
      return { success: false, error: "删除失败" };
    }

    if (cloudbaseResult.error) {
      console.warn("CloudBase delete social link warning:", cloudbaseResult.error);
    }

    // 删除存储文件
    if (iconUrl && supabaseAdmin) {
      try {
        const urlParts = iconUrl.split("/social-icons/");
        if (urlParts.length > 1) {
          const fileName = urlParts[1].split("?")[0];
          await supabaseAdmin.storage.from("social-icons").remove([fileName]);
        }
      } catch (err) {
        console.warn("Delete storage icon warning:", err);
      }
    }

    revalidatePath("/admin/social-links");

    return { success: true };
  } catch (err) {
    console.error("Delete social link error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "删除社交链接失败",
    };
  }
}

/**
 * 批量更新排序
 */
export async function updateSocialLinksOrder(
  orders: { id: string; sort_order: number }[]
): Promise<UpdateSocialLinkResult> {
  try {
    await requireAdmin();

    for (const { id, sort_order } of orders) {
      const updates = {
        sort_order,
        updated_at: new Date().toISOString(),
      };

      if (supabaseAdmin) {
        await supabaseAdmin.from("social_links").update(updates).eq("id", id);
      }

      try {
        const { db } = await getCloudBase();
        await db.collection("social_links").doc(id).update(updates);
      } catch (err) {
        console.warn("CloudBase update order warning:", err);
      }
    }

    revalidatePath("/admin/social-links");

    return { success: true };
  } catch (err) {
    console.error("Update social links order error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "更新排序失败",
    };
  }
}

/**
 * 列出社交链接图标文件
 */
export async function listSocialLinkFiles(): Promise<ListSocialLinkFilesResult> {
  try {
    await requireAdmin();

    const supabaseFiles: SocialLinkFile[] = [];
    const cloudbaseFiles: SocialLinkFile[] = [];

    // Supabase
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from("social-icons")
          .list("", { limit: 100 });

        if (!error && data) {
          for (const file of data) {
            const { data: urlData } = supabaseAdmin.storage
              .from("social-icons")
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
        console.warn("List Supabase social icon files warning:", err);
      }
    }

    // CloudBase
    try {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const db = connector.getClient();
      const app = connector.getApp();

      const { data } = await db.collection("social_links").get();

      if (data && Array.isArray(data)) {
        const fileIdList: string[] = [];
        const linkMap: Map<string, { link: any; fileName: string }> = new Map();

        for (const link of data) {
          if (link.icon_url) {
            let fileId: string | null = null;
            let fileName: string;

            if (link.icon_url.startsWith("cloud://")) {
              fileId = link.icon_url;
              const pathParts = link.icon_url.split("/");
              fileName = pathParts[pathParts.length - 1] || link._id;
            } else {
              const urlParts = link.icon_url.split("/");
              fileName = urlParts[urlParts.length - 1]?.split("?")[0] || link._id;

              cloudbaseFiles.push({
                name: fileName,
                url: link.icon_url,
                size: link.file_size,
                lastModified: link.created_at,
                source: "cloudbase",
                fileId: undefined,
                linkId: link._id || link.id,
              });
              continue;
            }

            if (fileId) {
              fileIdList.push(fileId);
              linkMap.set(fileId, { link, fileName });
            }
          }
        }

        if (fileIdList.length > 0) {
          try {
            const urlResult = await app.getTempFileURL({
              fileList: fileIdList,
            });

            if (urlResult.fileList && Array.isArray(urlResult.fileList)) {
              for (const fileInfo of urlResult.fileList) {
                const mapEntry = linkMap.get(fileInfo.fileID);
                if (mapEntry) {
                  const { link, fileName } = mapEntry;
                  const isSuccess = fileInfo.code === "SUCCESS" && fileInfo.tempFileURL;
                  const displayUrl = isSuccess ? fileInfo.tempFileURL : link.icon_url;

                  cloudbaseFiles.push({
                    name: fileName,
                    url: displayUrl,
                    size: link.file_size,
                    lastModified: link.created_at,
                    source: "cloudbase",
                    fileId: fileInfo.fileID,
                    linkId: link._id || link.id,
                  });

                  linkMap.delete(fileInfo.fileID);
                }
              }
            }

            for (const [fileId, { link, fileName }] of linkMap) {
              cloudbaseFiles.push({
                name: fileName,
                url: link.icon_url,
                size: link.file_size,
                lastModified: link.created_at,
                source: "cloudbase",
                fileId: fileId,
                linkId: link._id || link.id,
              });
            }
          } catch (urlErr) {
            console.error("CloudBase getTempFileURL error:", urlErr);
            for (const [fileId, { link, fileName }] of linkMap) {
              cloudbaseFiles.push({
                name: fileName,
                url: link.icon_url,
                size: link.file_size,
                lastModified: link.created_at,
                source: "cloudbase",
                fileId: fileId,
                linkId: link._id || link.id,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("List CloudBase social icon files error:", err);
    }

    return {
      success: true,
      supabaseFiles,
      cloudbaseFiles,
    };
  } catch (err) {
    console.error("List social link files error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "获取文件列表失败",
    };
  }
}

/**
 * 删除社交链接图标文件
 */
export async function deleteSocialLinkFile(
  fileName: string,
  source: "supabase" | "cloudbase",
  fileId?: string,
  linkId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (source === "supabase") {
      if (!supabaseAdmin) {
        return { success: false, error: "Supabase 未配置" };
      }

      const { error } = await supabaseAdmin.storage
        .from("social-icons")
        .remove([fileName]);

      if (error) {
        console.error("Supabase delete social icon error:", error);
        return { success: false, error: "删除文件失败" };
      }
    } else if (source === "cloudbase") {
      try {
        const connector = new CloudBaseConnector();
        await connector.initialize();
        const db = connector.getClient();
        const app = connector.getApp();

        if (linkId) {
          try {
            await db.collection("social_links").doc(linkId).remove();
          } catch (dbErr) {
            console.warn("CloudBase delete social link record warning:", dbErr);
          }
        }

        if (fileId && fileId.startsWith("cloud://")) {
          try {
            await app.deleteFile({ fileList: [fileId] });
          } catch (fileErr) {
            console.warn("CloudBase delete social icon file warning:", fileErr);
          }
        }
      } catch (err) {
        console.error("CloudBase delete social icon error:", err);
        return { success: false, error: "删除 CloudBase 文件失败" };
      }
    }

    revalidatePath("/admin/files");
    revalidatePath("/admin/social-links");
    return { success: true };
  } catch (err) {
    console.error("Delete social link file error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "删除文件失败",
    };
  }
}
