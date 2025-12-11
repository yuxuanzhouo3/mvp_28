import { CloudBaseConnector } from "@/lib/cloudbase/connector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

const getDashScopeProvider = (modelId: string) => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey || !modelId) return null;
  return {
    model: modelId,
    url: PROVIDER_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };
};

function extractFullText(data: any): string {
  const choice = data?.choices?.[0];
  if (!choice) return "";
  const content = choice.message?.content;
  if (Array.isArray(content)) {
    return content.map((c: any) => c.text ?? "").join("");
  }
  return content || "";
}

// Remove model reasoning markers like <think>...</think> from final text
function stripThinkContent(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleaned = cleaned.replace(/<\/?think>/gi, "");
  cleaned = cleaned.replace(/^[\s\u00A0]+/, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

const buildOpenAIMessages = (
  mergedMessages: any[],
  resolveImageUrl: (id: string) => string | null,
  resolveVideoUrl: (id: string) => string | null,
  resolveAudioUrl: (id: string) => { url: string; format: string } | null,
) => {
  return mergedMessages.map((m) => {
    const urls = (m.images || []).map((id: string) => resolveImageUrl(id)).filter(Boolean) as string[];
    const videoUrls = (m.videos || []).map((id: string) => resolveVideoUrl(id)).filter(Boolean) as string[];
    const audioUrls = (m.audios || []).map((id: string) => resolveAudioUrl(id)).filter(Boolean) as
      | { url: string; format: string }[]
      | [];

    if (!urls.length && !videoUrls.length && !audioUrls.length) {
      return { role: m.role, content: m.content };
    }
    if (urls.length && videoUrls.length) {
      throw new Error("同一条消息暂不支持同时包含图片和视频，请分开发送。");
    }
    if (audioUrls.length && (urls.length || videoUrls.length)) {
      throw new Error("同一条消息暂不支持同时包含音频与图片/视频，请分开发送。");
    }

    return {
      role: m.role,
      content: [
        ...audioUrls.slice(0, 1).map((a) => ({
          type: "input_audio",
          input_audio: { data: a.url, format: a.format },
        })),
        { type: "text", text: m.content },
        ...videoUrls.map((url) => ({ type: "video_url", video_url: { url } })),
        ...urls.map((url) => ({ type: "image_url", image_url: { url, detail: "high" as const } })),
      ],
    };
  });
};

export async function POST(req: Request) {
  try {
    type IncomingMessage = { role: string; content: string; images?: string[]; videos?: string[]; audios?: string[] };
    const { model, modelId, messages = [], message, language, images = [], videos = [], audios = [] } =
      (await req.json()) as {
        model?: string;
        modelId?: string;
        messages?: IncomingMessage[];
        message?: string;
        language?: string;
        images?: string[];
        videos?: string[];
        audios?: string[];
      };

    const hasMediaPayload =
      (Array.isArray(images) && images.length > 0) ||
      (Array.isArray(videos) && videos.length > 0) ||
      (Array.isArray(audios) && audios.length > 0) ||
      (Array.isArray(messages) &&
        messages.some((m) => (m?.images || m?.videos || m?.audios || []).length > 0));

    console.log("[media][send] incoming", {
      model,
      modelId,
      images: Array.isArray(images) ? images.length : 0,
      videos: Array.isArray(videos) ? videos.length : 0,
      audios: Array.isArray(audios) ? audios.length : 0,
      msgCount: Array.isArray(messages) ? messages.length : 0,
    });

    const modelName = hasMediaPayload ? "qwen3-omni-flash" : model || modelId || "qwen3-omni-flash";
    const provider = getDashScopeProvider(modelName);
    if (!provider) {
      return new Response(JSON.stringify({ success: false, error: "Unsupported model or missing API key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const mergedMessages: IncomingMessage[] =
      Array.isArray(messages) && messages.length > 0
        ? [...messages]
        : [{ role: "user", content: message || "", images, videos, audios }];

    if ((images?.length || videos?.length || audios?.length) && mergedMessages.length > 0) {
      const lastUserIdx = [...mergedMessages].reverse().findIndex((m) => m.role === "user");
      if (lastUserIdx !== -1) {
        const realIdx = mergedMessages.length - 1 - lastUserIdx;
        mergedMessages[realIdx] = {
          ...mergedMessages[realIdx],
          images: Array.from(new Set([...(mergedMessages[realIdx].images || []), ...(images || [])])),
          videos: Array.from(new Set([...(mergedMessages[realIdx].videos || []), ...(videos || [])])),
          audios: Array.from(new Set([...(mergedMessages[realIdx].audios || []), ...(audios || [])])),
        };
      }
    }

    const allImageIds = mergedMessages
      .flatMap((m) => m.images || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));
    const allVideoIds = mergedMessages
      .flatMap((m) => m.videos || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));
    const allAudioIds = mergedMessages
      .flatMap((m) => (m as any).audios || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));

    const audioCount = mergedMessages.reduce(
      (acc, m) => acc + ((m as any).audios?.length || 0),
      0,
    );
    if (audioCount > 1) {
      return new Response(
        JSON.stringify({ success: false, error: "音频输入目前仅支持单个文件，请分开发送。" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let tempUrlMap: Record<string, string> = {};
    const needIds = Array.from(new Set([...allImageIds, ...allVideoIds, ...allAudioIds]));
    if (needIds.length) {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const app = connector.getApp();
      const tempRes = await app.getTempFileURL({
        fileList: needIds.map((id: string) => ({ fileID: id, maxAge: 600 })),
      });
      tempUrlMap = Object.fromEntries(
        (tempRes.fileList || []).map((f: { fileID: string; tempFileURL: string }) => [f.fileID, f.tempFileURL])
      );

      console.log("[media][send] resolved temp URLs", {
        requested: needIds.length,
        resolved: Object.keys(tempUrlMap).length,
      });
    }

    const resolveImageUrl = (v: string) => (v.startsWith("http") ? v : tempUrlMap[v] || null);
    const resolveVideoUrl = (v: string) => (v.startsWith("http") ? v : tempUrlMap[v] || null);
    const resolveAudioUrl = (v: string) => {
      const url = v.startsWith("http") ? v : tempUrlMap[v];
      if (!url) return null;
      const clean = url.split("?")[0].toLowerCase();
      const ext = clean.match(/\.([a-z0-9]+)$/)?.[1] || "wav";
      const fmt = ext.replace(/[^a-z0-9]/g, "") || "wav";
      return { url, format: fmt };
    };

    let openaiMessages: any[];
    try {
      openaiMessages = buildOpenAIMessages(mergedMessages, resolveImageUrl, resolveVideoUrl, resolveAudioUrl);
      const firstUser = openaiMessages.find((m: any) => m.role === "user");
      console.log("[media][send] openaiMessages sample", {
        count: openaiMessages.length,
        firstUser,
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(provider.url, {
      method: "POST",
      headers: {
        ...provider.headers,
        ...(language === "zh" ? { "Accept-Language": "zh-CN,zh;q=0.9" } : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages: openaiMessages,
        stream: false,
        temperature: 0.7,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(JSON.stringify({ success: false, error: errText || "Upstream error" }), {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();
    const content = stripThinkContent(extractFullText(data));

    return new Response(
      JSON.stringify({ success: true, data: { response: content, chatId: Date.now().toString() } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
