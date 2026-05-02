import { request } from "./client";
import type {
  Scenario,
  SendMessageResponse,
  SessionDetail,
  StartAssessmentResponse,
  Report,
  ReportProgressEvent
} from "../types/assessment";

export function listScenarios() {
  return request<Scenario[]>("/api/assessment/scenarios");
}

export function startAssessment(input: { scenario_id?: string; nickname?: string }) {
  return request<StartAssessmentResponse>("/api/assessment/start", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getSession(sessionId: string) {
  return request<SessionDetail>(`/api/assessment/session/${sessionId}`);
}

export function sendMessage(sessionId: string, content: string) {
  return request<SendMessageResponse>("/api/assessment/message", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, content })
  });
}

export function getReport(sessionId: string) {
  return request<Report>(`/api/assessment/report/${sessionId}`);
}

// ── Streaming sendMessage ───────────────────────────────

export interface StreamEvents {
  onSpeaker: (speaker: string, role: string) => void;
  onToken: (token: string) => void;
  onJudging?: () => void;
  onReportProgress?: (progress: ReportProgressEvent) => void;
  onDone: (result: SendMessageResponse) => void;
  onError: (message: string) => void;
}

function parseStreamData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export async function sendMessageStream(
  sessionId: string,
  content: string,
  events: StreamEvents
): Promise<void> {
  const configuredApiBase = import.meta.env.VITE_API_BASE?.trim();
  const apiBase = configuredApiBase ? configuredApiBase.replace(/\/$/, "") : "";
  const url = `${apiBase}/api/assessment/message/stream`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, content })
  });

  if (!response.ok) {
    const text = await response.text();
    events.onError(`HTTP ${response.status}: ${text}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    events.onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let completed = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentEvent = "";
          continue;
        }

        if (trimmed.startsWith("event: ")) {
          currentEvent = trimmed.slice(7);
          continue;
        }

        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          const parsed = parseStreamData(data);

          if (currentEvent === "speaker") {
            if (parsed && typeof parsed === "object" && "speaker" in parsed && "role" in parsed) {
              const speakerEvent = parsed as { speaker?: unknown; role?: unknown };
              events.onSpeaker(String(speakerEvent.speaker ?? ""), String(speakerEvent.role ?? ""));
            }
          } else if (currentEvent === "judging") {
            events.onJudging?.();
          } else if (currentEvent === "report_progress") {
            if (parsed && typeof parsed === "object" && "stage" in parsed && "message" in parsed) {
              const progress = parsed as Partial<ReportProgressEvent>;
              events.onReportProgress?.({
                stage: String(progress.stage ?? "preparing"),
                message: String(progress.message ?? "报告生成中"),
                percent: typeof progress.percent === "number" ? progress.percent : 0,
                current: typeof progress.current === "number" ? progress.current : undefined,
                total: typeof progress.total === "number" ? progress.total : undefined,
                elapsedMs: typeof progress.elapsedMs === "number" ? progress.elapsedMs : undefined,
                delayed: Boolean(progress.delayed)
              });
            }
          } else if (currentEvent === "token") {
            events.onToken(typeof parsed === "string" ? parsed : String(parsed ?? ""));
          } else if (currentEvent === "done") {
            completed = true;
            if (parsed && typeof parsed === "object") {
              events.onDone(parsed as SendMessageResponse);
            } else {
              events.onError("Failed to parse done event");
            }
          } else if (currentEvent === "error") {
            completed = true;
            if (parsed && typeof parsed === "object" && "error" in parsed) {
              events.onError(String((parsed as { error?: unknown }).error ?? "Unknown error"));
            } else {
              events.onError(typeof parsed === "string" ? parsed : "Unknown error");
            }
          }
          currentEvent = "";
        }
      }
    }
  } catch (error) {
    if (!completed) {
      completed = true;
      events.onError(error instanceof Error ? error.message : "Stream connection failed");
    }
  }

  if (!completed) {
    events.onError("Stream closed before completion");
  }
}
