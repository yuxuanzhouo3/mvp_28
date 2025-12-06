export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const getMistralProvider = (modelId: string) => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey || !modelId) return null;
  return {
    model: modelId,
    url: MISTRAL_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };
};

// Extract streaming delta content from Mistral response
const extractDelta = (data: any): string => {
  const choice = data?.choices?.[0];
  if (!choice) return "";
  const delta = choice.delta?.content ?? choice.message?.content;
  if (Array.isArray(delta)) {
    return delta.map((c: any) => c?.text ?? c ?? "").join("");
  }
  return delta || "";
};

export async function POST(req: Request) {
  try {
    const { model, modelId, messages = [], message, language } = await req.json();
    const modelName = model || modelId || "codestral-latest";
    const provider = getMistralProvider(modelName);

    if (!provider) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing MISTRAL_API_KEY or model id" }),
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
          : { "Accept-Language": "en-US,en;q=0.9" }),
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
        JSON.stringify({ success: false, error: errText || "Upstream error" }),
        { status: upstream.status || 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    (async () => {
      const reader = upstream.body!.getReader();
      let buffer = "";
      let closed = false;
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
              if (!closed) {
                await writer.write(encoder.encode("data: [DONE]\n\n"));
                await writer.close();
                closed = true;
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = extractDelta(parsed);
              if (delta && delta.trim().length > 0) {
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({ chunk: delta })}\n\n`)
                );
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
      } catch (err) {
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              chunk: language === "zh" ? "抱歉，流式响应中断。" : "Stream interrupted.",
            })}\n\n`
          )
        );
      } finally {
        if (!closed) {
          try {
            await writer.write(encoder.encode("data: [DONE]\n\n"));
            await writer.close();
          } catch {
            // stream already closed, ignore
          }
        }
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
