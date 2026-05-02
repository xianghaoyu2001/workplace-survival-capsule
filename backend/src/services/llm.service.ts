import "dotenv/config";
import { mockDeepSeekResponse } from "./mockLlm.service";
import { createRequestId, log } from "../utils/logger";

type CallDeepSeekParams = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  thinking?: boolean;
  timeoutMs?: number;
  allowMockFallback?: boolean;
};

type StreamCallback = (token: string) => void;

// ── Prompt caching ─────────────────────────────────────
// Wrap the system prompt in a content array so the model
// provider can cache it across calls when byte-identical.

function buildSystemMessage(systemPrompt: string) {
  // Try structured format with cache hint; falls back gracefully
  // for providers that don't support cache_control.
  return [
    {
      type: "text" as const,
      text: systemPrompt,
      cache_control: { type: "ephemeral" as const }
    }
  ];
}

// ── Non-streaming call ─────────────────────────────────

async function requestDeepSeek(params: Required<CallDeepSeekParams>): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  const callId = createRequestId("llm");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  const startedAt = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: [
        { role: "system", content: buildSystemMessage(params.systemPrompt) },
        { role: "user", content: params.userPrompt }
      ],
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      stream: false
    };

    if (params.jsonMode) {
      body.response_format = { type: "json_object" };
    }
    if (params.thinking) {
      body.thinking = { type: "enabled" };
    }

    log("info", "DeepSeek request started", {
      callId,
      model: params.model,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      timeoutMs: params.timeoutMs,
      inputChars: params.userPrompt.length
    });

    const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`Empty DeepSeek response: ${JSON.stringify(data)}`);
    }

    log("info", "DeepSeek request finished", {
      callId,
      model: params.model,
      durationMs: Date.now() - startedAt,
      outputChars: content.length
    });

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callDeepSeek({
  systemPrompt,
  userPrompt,
  model,
  temperature = 0.7,
  maxTokens = 1200,
  jsonMode = true,
  thinking = false,
  timeoutMs = 90000,
  allowMockFallback = true
}: CallDeepSeekParams): Promise<string> {
  const selectedModel =
    model ||
    (thinking
      ? process.env.DEEPSEEK_STRONG_MODEL || process.env.DEEPSEEK_FAST_MODEL || "deepseek-v4-flash"
      : process.env.DEEPSEEK_FAST_MODEL || "deepseek-v4-flash");
  const useExplicitMock = process.env.USE_MOCK_LLM === "true";
  const useMock = useExplicitMock || (!process.env.DEEPSEEK_API_KEY && allowMockFallback);

  if (useMock) {
    return mockDeepSeekResponse(systemPrompt, userPrompt);
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  const normalizedParams: Required<CallDeepSeekParams> = {
    systemPrompt,
    userPrompt,
    model: selectedModel,
    temperature,
    maxTokens,
    jsonMode,
    thinking,
    timeoutMs,
    allowMockFallback
  };

  try {
    return await requestDeepSeek(normalizedParams);
  } catch (error) {
    log("warn", "DeepSeek call failed; retrying once", { error });
    try {
      return await requestDeepSeek(normalizedParams);
    } catch (retryError) {
      if (!allowMockFallback) {
        log("error", "DeepSeek retry failed; mock fallback disabled", { error: retryError });
        throw retryError;
      }
      log("warn", "DeepSeek retry failed; falling back to local mock agent", { error: retryError });
      return mockDeepSeekResponse(systemPrompt, userPrompt);
    }
  }
}

// ── Streaming call ─────────────────────────────────────

export async function streamDeepSeek({
  systemPrompt,
  userPrompt,
  model,
  temperature = 0.65,
  maxTokens = 900,
  jsonMode = true,
  timeoutMs = 90000,
  onToken
}: CallDeepSeekParams & { onToken: StreamCallback }): Promise<string> {
  const useMock = process.env.USE_MOCK_LLM === "true" || !process.env.DEEPSEEK_API_KEY;

  if (useMock) {
    // Mock: simulate streaming by yielding the full response token by token
    const full = await mockDeepSeekResponse(systemPrompt, userPrompt);
    for (const char of full) {
      onToken(char);
    }
    return full;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  const selectedModel =
    model ||
    process.env.DEEPSEEK_FAST_MODEL ||
    "deepseek-v4-flash";

  const callId = createRequestId("lls");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const body: Record<string, unknown> = {
      model: selectedModel,
      messages: [
        { role: "system", content: buildSystemMessage(systemPrompt) },
        { role: "user", content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true }
    };

    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    log("info", "DeepSeek stream started", {
      callId, model: selectedModel, maxTokens, inputChars: userPrompt.length
    });

    const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek stream ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            onToken(delta);
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }

    log("info", "DeepSeek stream finished", {
      callId, model: selectedModel, durationMs: Date.now() - startedAt, outputChars: fullContent.length
    });

    return fullContent;
  } catch (error) {
    log("warn", "DeepSeek stream failed; falling back to non-streaming", { error });
    clearTimeout(timeout);
    // Fall back to non-streaming
    const full = await callDeepSeek({ systemPrompt, userPrompt, model, temperature, maxTokens, jsonMode, timeoutMs });
    for (const char of full) {
      onToken(char);
    }
    return full;
  } finally {
    clearTimeout(timeout);
  }
}
