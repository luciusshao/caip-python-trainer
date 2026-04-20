import { NextRequest } from "next/server";
import aiConfig from "../../../../config/ai_model.json";
import { prisma } from "@/lib/prisma";
import { getStudentProfileId } from "@/lib/session";
import { limitChat } from "@/lib/ratelimit";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  context?: {
    taskDesc?: string;
    studentCode?: string;
    errorMsg?: string;
  };
}

interface TokenUsageData {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

function buildSystemPrompt(context?: ChatRequestBody["context"]): string {
  let prompt = aiConfig.systemPrompt;
  prompt = prompt.replace("{task_desc}", context?.taskDesc || "N/A");
  prompt = prompt.replace("{student_code}", context?.studentCode || "N/A");
  prompt = prompt.replace("{error_msg}", context?.errorMsg || "None");
  return prompt;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || apiKey === "sk-your-deepseek-api-key-here") {
    return new Response(
      JSON.stringify({ error: "LLM_API_KEY not configured. Set it in .env.local" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, context } = body;
  if (!messages || !Array.isArray(messages)) {
    return new Response(
      JSON.stringify({ error: "messages array is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Resolve StudentProfile.id for token usage tracking.
  const studentId = await getStudentProfileId();

  // Rate limit: 20 requests / 60s per studentId (or IP fallback).
  const rateKey =
    studentId ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "anonymous";
  const rate = await limitChat(rateKey);
  if (!rate.success) {
    return new Response(
      JSON.stringify({
        error: "请求过于频繁，请稍后再试（每分钟最多 20 次）",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    );
  }

  const systemPrompt = buildSystemPrompt(context);
  const fullMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  try {
    const response = await fetch(aiConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.modelName,
        messages: fullMessages,
        temperature: aiConfig.temperature,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `LLM API error: ${response.status} - ${errorText}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response back using Web Streams API
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = "";
        let usage: TokenUsageData | null = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(data);

                // Extract token usage from stream (usually in the last chunk)
                if (parsed.usage) {
                  usage = parsed.usage as TokenUsageData;
                }

                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                  );
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();

          // Async write token usage to DB (fire-and-forget)
          if (usage && studentId) {
            prisma.tokenUsage.create({
              data: {
                studentId,
                model: aiConfig.modelName,
                promptTokens: usage.prompt_tokens || 0,
                completionTokens: usage.completion_tokens || 0,
                totalTokens: usage.total_tokens || 0,
              },
            }).catch((err: unknown) => {
              console.error("Failed to save token usage:", err);
            });
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Failed to connect to LLM: ${err instanceof Error ? err.message : "Unknown error"}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
