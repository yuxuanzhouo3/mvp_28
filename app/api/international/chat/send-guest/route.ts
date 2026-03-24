import { NextResponse } from "next/server";
import { POST as streamPost } from "../stream-guest/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readSseTextFromResponse(response: Response) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed?.chunk === "string") {
          output += parsed.chunk;
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }

  return output.trim();
}

export async function POST(req: Request) {
  try {
    const streamResponse = await streamPost(req);
    const contentType = streamResponse.headers.get("content-type") || "";

    if (!streamResponse.ok) {
      const raw = await streamResponse.text();
      try {
        const parsed = JSON.parse(raw);
        return NextResponse.json(parsed, { status: streamResponse.status });
      } catch {
        return NextResponse.json(
          { success: false, error: raw || "Request failed" },
          { status: streamResponse.status },
        );
      }
    }

    if (!contentType.includes("text/event-stream")) {
      const raw = await streamResponse.text();
      try {
        const parsed = JSON.parse(raw);
        return NextResponse.json(parsed, { status: 200 });
      } catch {
        return NextResponse.json({
          success: true,
          data: { response: raw, chatId: Date.now().toString() },
        });
      }
    }

    const text = await readSseTextFromResponse(streamResponse);
    return NextResponse.json({
      success: true,
      data: { response: text, chatId: Date.now().toString() },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
