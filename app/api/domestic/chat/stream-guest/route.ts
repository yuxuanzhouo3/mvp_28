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

function extractDelta(data: any): string {
  const choice = data?.choices?.[0];
  if (!choice) return "";
  const delta = choice.delta?.content ?? choice.message?.content;
  if (Array.isArray(delta)) {
    return delta.map((c: any) => c.text ?? "").join("");
  }
  return delta || "";
}

const buildOpenAIMessages = (
  mergedMessages: any[],
  resolveImageUrl: (id: string) => string | null,
  resolveVideoUrl: (id: string) => string | null
) => {
  return mergedMessages.map((m) => {
    const urls = (m.images || []).map((id: string) => resolveImageUrl(id)).filter(Boolean) as string[];
    const videoUrls = (m.videos || []).map((id: string) => resolveVideoUrl(id)).filter(Boolean) as string[];

    if (!urls.length && !videoUrls.length) {
      return { role: m.role, content: m.content };
    }
    if (urls.length && videoUrls.length) {
      throw new Error("同一条消息暂不支持同时包含图片和视频，请分开发送。");
    }

    return {
      role: m.role,
      content: [
        { type: "text", text: m.content },
        ...videoUrls.map((url) => ({ type: "video_url", video_url: { url } })),
        ...urls.map((url) => ({ type: "image_url", image_url: { url, detail: "high" as const } })),
      ],
    };
  });
};

export async function POST(req: Request) {
  try {
    type IncomingMessage = { role: string; content: string; images?: string[]; videos?: string[] };
    const { model, modelId, messages = [], message, language, images = [], videos = [] } =
      (await req.json()) as {
        model?: string;
        modelId?: string;
        messages?: IncomingMessage[];
        message?: string;
        language?: string;
        images?: string[];
        videos?: string[];
      };

    const hasMediaPayload =
      (Array.isArray(images) && images.length > 0) ||
      (Array.isArray(videos) && videos.length > 0) ||
      (Array.isArray(messages) && messages.some((m) => (m?.images || m?.videos || []).length > 0));

    console.log("[media][stream] incoming", {
      model,
      modelId,
      images: Array.isArray(images) ? images.length : 0,
      videos: Array.isArray(videos) ? videos.length : 0,
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
        : [{ role: "user", content: message || "", images, videos }];

    if ((images?.length || videos?.length) && mergedMessages.length > 0) {
      const lastUserIdx = [...mergedMessages].reverse().findIndex((m) => m.role === "user");
      if (lastUserIdx !== -1) {
        const realIdx = mergedMessages.length - 1 - lastUserIdx;
        mergedMessages[realIdx] = {
          ...mergedMessages[realIdx],
          images: Array.from(new Set([...(mergedMessages[realIdx].images || []), ...(images || [])])),
          videos: Array.from(new Set([...(mergedMessages[realIdx].videos || []), ...(videos || [])])),
        };
      }
    }

    const allImageIds = mergedMessages
      .flatMap((m) => m.images || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));
    const allVideoIds = mergedMessages
      .flatMap((m) => m.videos || [])
      .filter((v) => typeof v === "string" && !v.startsWith("http"));

    let tempUrlMap: Record<string, string> = {};
    const needIds = Array.from(new Set([...allImageIds, ...allVideoIds]));
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

      console.log("[media][stream] resolved temp URLs", {
        requested: needIds.length,
        resolved: Object.keys(tempUrlMap).length,
      });
    }

    const resolveImageUrl = (v: string) => (v.startsWith("http") ? v : tempUrlMap[v] || null);
    const resolveVideoUrl = (v: string) => (v.startsWith("http") ? v : tempUrlMap[v] || null);

    let openaiMessages: any[];
    try {
      openaiMessages = buildOpenAIMessages(mergedMessages, resolveImageUrl, resolveVideoUrl);
      const firstUser = openaiMessages.find((m: any) => m.role === "user");
      console.log("[media][stream] openaiMessages sample", {
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
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text();
      return new Response(JSON.stringify({ success: false, error: errText || "Upstream error" }), {
        status: upstream.status || 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const THINK_OPEN = "<think>";
    const THINK_CLOSE = "</think>";
    let thinkBuffer = "";
    let inThinkBlock = false;
    let firstContentEmitted = false;

    const filterThinkContent = (chunk: string): string => {
      thinkBuffer += chunk;
      let output = "";

      while (thinkBuffer.length) {
        if (!inThinkBlock) {
          const openIdx = thinkBuffer.toLowerCase().indexOf(THINK_OPEN);
          if (openIdx === -1) {
            output += thinkBuffer;
            thinkBuffer = "";
            break;
          }
          output += thinkBuffer.slice(0, openIdx);
          thinkBuffer = thinkBuffer.slice(openIdx + THINK_OPEN.length);
          inThinkBlock = true;
        } else {
          const closeIdx = thinkBuffer.toLowerCase().indexOf(THINK_CLOSE);
          if (closeIdx === -1) {
            thinkBuffer = "";
            break;
          }
          thinkBuffer = thinkBuffer.slice(closeIdx + THINK_CLOSE.length);
          inThinkBlock = false;
        }
      }

      output = output.replace(/<\/?think>/gi, "");

      if (!firstContentEmitted) {
        output = output.replace(/^[\s\u00A0]+/, "");
        if (output.trim().length > 0) {
          firstContentEmitted = true;
        }
      }

      output = output.replace(/\n{3,}/g, "\n\n");
      return output;
    };

    (async () => {
      const reader = upstream.body!.getReader();
      let buffer = "";
      let doneSent = false;
      let closed = false;
      const safeWrite = async (data: Uint8Array) => {
        if (closed) return;
        try {
          await writer.write(data);
        } catch {
          closed = true;
        }
      };
      const sendDone = async () => {
        if (doneSent) return;
        doneSent = true;
        await safeWrite(encoder.encode("data: [DONE]\n\n"));
      };
      const closeWriter = async () => {
        if (closed) return;
        closed = true;
        try {
          await writer.close();
        } catch {}
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              await sendDone();
              await closeWriter();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = extractDelta(parsed);
              const cleaned = filterThinkContent(delta);
              if (cleaned && cleaned.trim().length > 0) {
                await safeWrite(encoder.encode(`data: ${JSON.stringify({ chunk: cleaned })}\n\n`));
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
      } catch (err) {
        await safeWrite(
          encoder.encode(
            `data: ${JSON.stringify({
              chunk: language === "zh" ? "抱歉，流式响应中断。" : "Stream interrupted.",
            })}\n\n`
          )
        );
      } finally {
        await sendDone();
        await closeWriter();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

