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

export async function POST(req: Request) {
  try {
    // Accept both "model" (preferred) and legacy "modelId" for compatibility
    const { model, modelId, messages = [], message, language } = await req.json();
    const modelName = model || modelId;
    const provider = getDashScopeProvider(modelName);

    if (!provider) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unsupported model or missing API key",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const finalMessages =
      Array.isArray(messages) && messages.length > 0
        ? messages
        : [{ role: "user", content: message }];

    const upstream = await fetch(provider.url, {
      method: "POST",
      headers: {
        ...provider.headers,
        ...(language === "zh"
          ? { "Accept-Language": "zh-CN,zh;q=0.9" }
          : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages: finalMessages,
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: errText || "Upstream error",
        }),
        { status: upstream.status || 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Stateful filter to drop <think>...</think> blocks from streaming chunks
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

      // Remove any stray tags that slipped through
      output = output.replace(/<\/?think>/gi, "");

      // On first meaningful content, trim leading whitespace/newlines
      if (!firstContentEmitted) {
        output = output.replace(/^[\s\u00A0]+/, "");
        if (output.trim().length > 0) {
          firstContentEmitted = true;
        }
      }

      // Collapse excessive blank lines within chunk
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
        } catch {
          // ignore double-close errors
        }
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
              // Skip if chunk is only whitespace after filtering
              if (cleaned && cleaned.trim().length > 0) {
                await safeWrite(
                  encoder.encode(
                    `data: ${JSON.stringify({ chunk: cleaned })}\n\n`
                  )
                );
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
              chunk:
                language === "zh"
                  ? "抱歉，流式响应中断。"
                  : "Stream interrupted.",
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
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
