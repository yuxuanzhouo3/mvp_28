import { NextResponse } from "next/server";

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
  // Remove complete <think>...</think> blocks
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Remove any stray tags if stream was cut mid-way
  cleaned = cleaned.replace(/<\/?think>/gi, "");
  // Trim leading whitespace/newlines that were left after stripping
  cleaned = cleaned.replace(/^[\s\u00A0]+/, "");
  // Collapse excessive blank lines inside the answer
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

export async function POST(req: Request) {
  try {
    // Accept both "model" (preferred) and legacy "modelId" for compatibility
    const { model, modelId, message, messages = [], language } = await req.json();
    const modelName = model || modelId;

    const provider = getDashScopeProvider(modelName);
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Unsupported model or missing API key" },
        { status: 400 }
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
        stream: false,
        temperature: 0.7,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return NextResponse.json(
        { success: false, error: errText || "Upstream error" },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    const content = stripThinkContent(extractFullText(data));

    return NextResponse.json({
      success: true,
      data: {
        response: content,
        chatId: Date.now().toString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
