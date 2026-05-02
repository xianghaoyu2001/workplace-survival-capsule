import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getSession, sendMessageStream } from "../api/assessment.api";
import { ChatBubble } from "../components/ChatBubble";
import { SceneFrame } from "../components/layout/SceneFrame";
import { MessageInput } from "../components/MessageInput";
import { getScenarioPresentation } from "../config/scenarioPresentation";
import type { Message, ReportProgressEvent, Scenario, SessionDetail } from "../types/assessment";

const typingMessageId = "agent-typing";
const reportGeneratingMessageId = "report-generating";
const NICKNAME_KEY = "maat_nickname";
const TURN_TIME_LIMIT = 240;
const WARNING_THRESHOLD = 25;
const REPORT_PROGRESS_STALE_MS = 12000;

type TimedReportProgress = ReportProgressEvent & {
  startedAt: number;
  receivedAt: number;
};

function clampProgressPercent(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 5;
  return Math.max(5, Math.min(100, Math.round(value)));
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function sampleProgressText(progress: TimedReportProgress | null): string {
  if (!progress || progress.stage !== "judge_sampling" || !progress.total) {
    return "阶段进度会在后端完成对应步骤后更新";
  }
  return `Judge 采样 ${progress.current ?? 0}/${progress.total}`;
}

function getStoredNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? "用户";
  } catch {
    return "用户";
  }
}

export function ChatPage() {
  const userNickname = getStoredNickname();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [sending, setSending] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportProgress, setReportProgress] = useState<TimedReportProgress | null>(null);
  const [reportProgressTick, setReportProgressTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryContent, setRetryContent] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(TURN_TIME_LIMIT);
  const timerRef = useRef<number | null>(null);
  const timedOutRef = useRef(false);
  const hasSentFirstMessageRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const reportRedirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    getSession(sessionId)
      .then((result) => {
        setDetail(result);
        setScenario(result.scenario);
        setMessages(result.messages);
        setReportGenerating(false);
        setReportProgress(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [sessionId]);

  const isUserTurn = !sending && !reportGenerating && detail?.session.status === "running";
  const timeWarning = timeRemaining <= WARNING_THRESHOLD && isUserTurn;

  // Timer: countdown + timeout handled inside setInterval (avoids stale-closure cascade)
  // 首轮回复前不计时
  useEffect(() => {
    if (isUserTurn && hasSentFirstMessageRef.current) {
      setTimeRemaining(TURN_TIME_LIMIT);
      timedOutRef.current = false;
      timerRef.current = window.setInterval(() => {
        setTimeRemaining((prev) => {
          const next = prev - 1;
          if (next <= 0 && !timedOutRef.current) {
            timedOutRef.current = true;
            // Fire timeout on next tick so state is consistent
            window.setTimeout(() => {
              handleSubmit("（时间到）");
            }, 0);
            return 0;
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserTurn]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!reportGenerating) return;
    const timer = window.setInterval(() => {
      setReportProgressTick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [reportGenerating]);

  useEffect(() => {
    return () => {
      if (reportRedirectTimerRef.current) {
        window.clearTimeout(reportRedirectTimerRef.current);
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  const progress = useMemo(() => {
    const round = detail?.session.round ?? 0;
    const maxRound = scenario?.maxRound ?? 10;
    return Math.round((round / maxRound) * 100);
  }, [detail, scenario]);

  const currentRound = detail?.session.round ?? 0;
  const maxRound = scenario?.maxRound ?? 10;
  const statusText = detail?.session.status === "finished" ? "测评已结束" : sending ? "对方正在组织回复" : "模拟进行中";
  const presentation = getScenarioPresentation(scenario);
  const reportProgressPercent = clampProgressPercent(reportProgress?.percent);
  const reportProgressNow = useMemo(() => Date.now(), [reportProgressTick, reportProgress?.receivedAt]);
  const reportProgressElapsedMs = reportProgress
    ? Math.max(reportProgress.elapsedMs ?? 0, reportProgressNow - reportProgress.startedAt)
    : 0;
  const reportProgressStaleMs = reportProgress ? reportProgressNow - reportProgress.receivedAt : 0;
  const reportProgressDelayed = reportProgress ? reportProgress.delayed || reportProgressStaleMs >= REPORT_PROGRESS_STALE_MS : false;
  const reportProgressMessage = reportProgress?.message ?? "测评结束，正在生成行为观察报告…";

  async function handleSubmit(content: string, options: { appendUserMessage?: boolean } = {}) {
    if (!sessionId || sending || reportGenerating) {
      return;
    }

    hasSentFirstMessageRef.current = true;
    const appendUserMessage = options.appendUserMessage ?? true;
    const currentRound = detail?.session.round ?? 0;
    const now = Date.now();
    const localMessage: Message = {
      id: `local-${now}`,
      senderType: "user",
      senderName: userNickname,
      senderRole: "受试者",
      content,
      roundIndex: currentRound
    };
    const typingMessage: Message = {
      id: typingMessageId,
      senderType: "typing",
      senderName: "对方",
      senderRole: "正在组织回复",
      content: "",
      roundIndex: currentRound + 1
    };

    setMessages((current) => {
      const cleanMessages = current.filter((m) => m.id !== typingMessageId);
      return appendUserMessage ? [...cleanMessages, localMessage, typingMessage] : [...cleanMessages, typingMessage];
    });
    setSending(true);
    setError(null);
    setRetryContent(null);
    setReportProgress(null);
    const startedAt = performance.now();
    const streamMsgId = `agent-streaming-${now}`;

    // Use streaming for perceptual responsiveness
    await sendMessageStream(sessionId, content, {
      onJudging: () => {
        // The orchestration agent decided to finish; scoring is about to run.
        // Clear typing and show the report generation state.
        setMessages((current) => current.filter((m) => m.id !== typingMessageId));
        setSending(false);
        const judgingMessage: Message = {
          id: reportGeneratingMessageId,
          senderType: "agent",
          senderName: "测评系统",
          senderRole: "分析中",
          content: "测评结束，正在生成行为观察报告…",
          roundIndex: currentRound + 1
        };
        setMessages((current) => [
          ...current.filter((m) => m.id !== reportGeneratingMessageId),
          judgingMessage
        ]);
        setReportGenerating(true);
        const receivedAt = Date.now();
        setReportProgress({
          stage: "preparing",
          message: "测评结束，正在整理报告材料。",
          percent: 5,
          startedAt: receivedAt,
          receivedAt
        });
      },
      onReportProgress: (progress) => {
        const receivedAt = Date.now();
        setReportGenerating(true);
        setReportProgress((current) => ({
          ...progress,
          percent: clampProgressPercent(progress.percent),
          startedAt: current?.startedAt ?? receivedAt,
          receivedAt
        }));
      },
      onSpeaker: (speaker, role) => {
        // Replace typing indicator with the real speaker identity
        setMessages((current) =>
          current.map((m) =>
            m.id === typingMessageId
              ? { ...m, id: streamMsgId, senderType: "agent", senderName: speaker, senderRole: role, content: "" }
              : m
          )
        );
      },
      onToken: (token) => {
        // Append streaming text to the agent message
        setMessages((current) =>
          current.map((m) =>
            m.id === streamMsgId || m.id === typingMessageId
              ? {
                  ...m,
                  id: streamMsgId,
                  senderType: "agent",
                  senderName: m.senderName === "对方" ? "..." : m.senderName,
                  senderRole: m.senderRole === "正在组织回复" ? "" : m.senderRole,
                  content: (m.id === streamMsgId ? m.content : "") + token
                }
              : m
          )
        );
      },
      onDone: (result) => {

        const agentMessage: Message = {
          id: `agent-${Date.now()}`,
          senderType: "agent",
          senderName: result.reply.speaker,
          senderRole: result.reply.role,
          content: result.reply.content,
          roundIndex: result.round
        };

        if (result.finished) {
          // Report is already generated — show final state and redirect shortly
          const formalReport =
            result.report?.report_status === "confident" && !result.report?.mock_generated;
          const reportSummary = formalReport
            ? `测评完成 · 参考指数 ${result.report?.total_score ?? "—"} / ${result.report?.dimension_scores ? Object.keys(result.report.dimension_scores).length * 20 : 100} · 观察区间 ${result.report?.level ?? "—"}`
            : `测评完成 · 报告已生成 · ${result.report?.level ?? "观察反馈"}`;
          const doneMessage: Message = {
            id: reportGeneratingMessageId,
            senderType: "agent",
            senderName: "测评系统",
            senderRole: "报告已生成",
            content: reportSummary,
            roundIndex: result.round
          };

          setMessages((current) => [
            ...current.filter((m) => m.id !== streamMsgId && m.id !== typingMessageId && m.id !== reportGeneratingMessageId),
            agentMessage,
            doneMessage
          ]);
          setDetail((current) =>
            current
              ? {
                  ...current,
                  session: {
                    ...current.session,
                    round: result.round,
                    status: "finished",
                    reportJson: result.report ?? current.session.reportJson
                  }
                }
              : current
          );
          setSending(false);
          setReportProgress((current) => current ? { ...current, stage: "done", percent: 100, message: "行为观察报告已生成。", receivedAt: Date.now() } : current);
          reportRedirectTimerRef.current = window.setTimeout(() => {
            navigate(`/report/${sessionId}`);
          }, 1500);
          setRetryContent(null);
        } else {
          setMessages((current) =>
            current.map((m) => (m.id === streamMsgId || m.id === typingMessageId ? agentMessage : m))
          );
          setSending(false);
          setDetail((current) =>
            current
              ? {
                  ...current,
                  session: {
                    ...current.session,
                    round: result.round,
                    status: current.session.status,
                    reportJson: result.report ?? current.session.reportJson
                  }
                }
              : current
          );
          setRetryContent(null);
        }
      },
      onError: (msg) => {
        setMessages((current) => current.filter((m) => m.id !== typingMessageId && m.id !== streamMsgId));
        console.error("[chat:error]", { sessionId, round: currentRound, error: msg });
        setError(msg);
        setRetryContent(content);
        setSending(false);
        setReportGenerating(false);
        setReportProgress(null);
      }
    });
  }

  function retryLastMessage() {
    if (retryContent) {
      void handleSubmit(retryContent, { appendUserMessage: false });
    }
  }

  return (
    <SceneFrame scenarioId={scenario} className={`chat-shell ${timeWarning ? "chat-time-warning" : ""}`}>
      {timeWarning ? <div className="time-warning-overlay" /> : null}
      <aside className="scenario-brief">
        <div className="scenario-brief-head">
          <Link to="/scenarios">返回场景</Link>
          <span>{presentation.badge}</span>
        </div>
        <h1>{scenario?.title ?? "测评会话"}</h1>
        <div className="scene-caption">
          <span>当前测评目标</span>
          <strong>{presentation.tagline}</strong>
        </div>
        <div className="dossier-body">{scenario?.backgroundForUser ?? "正在读取场景..."}</div>
        <div className="progress-block">
          <div>
            <span>进度</span>
            <strong>
              {currentRound}/{maxRound}
            </strong>
          </div>
          <div className="progress-track">
            <div style={{ width: `${progress}%` }} />
          </div>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-panel-head">
          <div>
            <span>Live Assessment</span>
            <strong>{scenario?.title ?? "多角色测评"}</strong>
          </div>
          <div className={`session-status ${sending ? "session-status-live" : ""}`}>{statusText}</div>
        </header>
        <div className="chat-scroll" aria-live="polite">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          <div ref={chatEndRef} />
        </div>
        {error ? (
          <div className="error-box" role="alert">
            <span>{error}</span>
            {retryContent && detail?.session.status === "running" ? (
              <button type="button" onClick={retryLastMessage} disabled={sending || reportGenerating}>
                重试发送
              </button>
            ) : null}
          </div>
        ) : null}
        {reportGenerating ? (
          <div className="report-generating" role="status" aria-live="polite">
            <div className="report-generating-top">
              <span>{reportProgressMessage}</span>
              <strong>{reportProgressPercent}%</strong>
            </div>
            <div
              className="report-generating-bar"
              role="progressbar"
              aria-label="行为观察报告生成进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={reportProgressPercent}
            >
              <div className="report-generating-bar-fill" style={{ width: `${reportProgressPercent}%` }} />
            </div>
            <div className="report-generating-meta">
              <span>{sampleProgressText(reportProgress)}</span>
              <span>
                {reportProgressDelayed
                  ? "当前阶段耗时较长，模型返回后会继续更新"
                  : `已等待 ${formatElapsed(reportProgressElapsedMs)}`}
              </span>
            </div>
          </div>
        ) : detail?.session.status === "finished" ? (
          <Link className="primary-link" to={`/report/${sessionId}`}>
            查看报告
          </Link>
        ) : (
          <MessageInput
            disabled={sending || reportGenerating || !detail}
            onSubmit={handleSubmit}
            timeRemaining={isUserTurn ? timeRemaining : TURN_TIME_LIMIT}
            timeWarning={timeWarning}
          />
        )}
      </section>
    </SceneFrame>
  );
}




