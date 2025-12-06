import { NextResponse } from "next/server";

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

const extractFullText = (data: any): string => {
  const choice = data?.choices?.[0];
  if (!choice) return "";
  const content = choice.message?.content;
  if (Array.isArray(content)) {
    return content.map((c: any) => c?.text ?? c ?? "").join("");
  }
  return content || "";
};

export async function POST(req: Request) {
  try {
    const { model, modelId, message, messages = [], language } = await req.json();
    const modelName = model || modelId || "codestral-latest";
    const provider = getMistralProvider(modelName);

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Missing MISTRAL_API_KEY or model id" },
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
          : { "Accept-Language": "en-US,en;q=0.9" }),
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
    const content = extractFullText(data);

    return NextResponse.json({
      success: true,
      data: { response: content, chatId: Date.now().toString() },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
