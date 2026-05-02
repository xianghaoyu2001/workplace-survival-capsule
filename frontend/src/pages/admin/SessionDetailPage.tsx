import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAdminSessionDetail } from "../../api/admin.api";
import { GroupDiscussionPanel } from "../../components/admin/GroupDiscussionPanel";
import { SessionReplay } from "../../components/admin/SessionReplay";
import { RadarChart } from "../../components/RadarChart";
import { getDimensionColor, getDimensionLabel } from "../../config/dimensions";
import type { AdminSessionDetail } from "../../types/admin";
import type { Report } from "../../types/assessment";

function confidenceLevel(variance: number) {
  if (variance < 30) return { label: "高可信", cls: "conf-high" };
  if (variance < 80) return { label: "中可信", cls: "conf-mid" };
  return { label: "建议人工复核", cls: "conf-low" };
}

function statusMeta(report?: Report | null) {
  if (!report) return { label: "无报告", cls: "conf-low", note: "" };
  if (report.report_status === "scoring_failed") {
    return { label: "评分失败", cls: "conf-low", note: "评分服务暂时不可用，请稍后重试。" };
  }
  if (report.report_status === "debug" || report.mock_generated) {
    return { label: "调试报告", cls: "conf-low", note: "mock Judge Agent 结果，仅用于调试。" };
  }
  if (report.report_status === "unratable") {
    return { label: "仅观察反馈", cls: "conf-low", note: "采样分歧过大，仅保留观察记录。" };
  }
  if (report.report_status === "provisional") {
    return { label: "观察性反馈", cls: "conf-mid", note: "观察点覆盖不足，不建议横向比较。" };
  }
  return { label: "本次观察结果", cls: "conf-high", note: "通过采样和覆盖检查。" };
}

function scoringFailureReason(report?: Report | null) {
  return report?.scoring_error_reason ?? report?.reason ?? report?.human_review_reason ?? "评分服务暂时不可用，请稍后重试。";
}

export function SessionDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<AdminSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getAdminSessionDetail(id)
      .then(setDetail)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <>
        <div className="admin-heading">
          <span className="section-label">Session Detail</span>
          <h1>{id?.slice(0, 8)}</h1>
        </div>
        <p className="error-box">{error}</p>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <div className="admin-heading">
          <span className="section-label">Session Detail</span>
          <h1>{id?.slice(0, 8)}</h1>
        </div>
        <p className="loading-state">加载会话详情...</p>
      </>
    );
  }

  const s = detail.session;
  const report = detail.report as Report | null;
  const scoringFailed = report?.report_status === "scoring_failed";
  const scoreableReport = report && !scoringFailed ? report : null;
  const conf = scoreableReport?.sampling_stats ? confidenceLevel(scoreableReport.sampling_stats.variance) : null;
  const status = statusMeta(report);
  const sortedDims = scoreableReport ? Object.entries(scoreableReport.dimension_scores).sort((a, b) => b[1] - a[1]) : [];
  const dimKeys = scoreableReport ? Object.keys(scoreableReport.dimension_scores) : [];
  const formalScore = scoreableReport?.report_status === "confident" && !scoreableReport.mock_generated;
  const displayedScore = formalScore ? (s.totalScore ?? scoreableReport?.total_score ?? "—") : "未形成";
  const statusClass =
    s.status === "finished" ? "status-pill-finished" : s.status === "running" ? "status-pill-running" : s.status === "abandoned" ? "status-pill-abandoned" : "";
  const statusText =
    s.status === "finished"
      ? "已完成"
      : s.status === "running"
        ? "进行中"
        : s.status === "abandoned"
          ? "已超时"
          : s.status === "scoring_failed"
            ? "评分失败"
            : s.status;

  return (
    <>
      <div className="admin-heading">
        <span className="section-label">Session Detail</span>
        <h1>{id?.slice(0, 8)}</h1>
      </div>

      <div className="session-console">
        <div className="session-console-summary">
          <div>
            <span>状态</span>
            <strong><span className={`status-pill ${statusClass}`}>{statusText}</span></strong>
          </div>
          <div>
            <span>轮次</span>
            <strong>{s.round}</strong>
          </div>
          <div>
            <span>参考指数</span>
            <strong>{displayedScore}</strong>
          </div>
          <div>
            <span>报告状态</span>
            <strong><span className={`confidence-pill ${status.cls}`}>{status.label}</span></strong>
          </div>
        </div>
      </div>

      {scoringFailed ? (
        <section className="admin-card" style={{ marginTop: 20 }}>
          <h2>评分失败</h2>
          <p className="muted">{scoringFailureReason(report)}</p>
          <p className="muted">会话回放和黑板状态仍保留，当前没有可展示的参考指数。</p>
        </section>
      ) : report ? (
        <>
          <section className="admin-card" style={{ marginTop: 20 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: "var(--accent)", fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 750 }}>
                观察区间 · {report.level}
              </span>
              <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                冲突风格 · {report.conflict_style}
              </span>
              {conf ? (
                <span className={`confidence-pill ${conf.cls}`} title={`采样结果: [${report.sampling_stats!.scores.join(", ")}] · 方差: ${report.sampling_stats!.variance}`}>
                  {conf.label} · σ²={report.sampling_stats!.variance}
                </span>
              ) : null}
              {report.coverage_status ? (
                <span className={`confidence-pill ${report.coverage_status.complete ? "conf-high" : "conf-mid"}`}>
                  观察点覆盖 {report.coverage_status.covered_dimensions.length}/{report.coverage_status.covered_dimensions.length + report.coverage_status.insufficient_dimensions.length}
                </span>
              ) : null}
              {report.human_review_required ? (
                <span className="confidence-pill conf-low" title={report.human_review_reason || "需要人工复核"}>
                  需复核
                </span>
              ) : null}
            </div>
            {status.note ? <p className="muted">{status.note}</p> : null}
            {report.human_review_reason ? <p className="muted">{report.human_review_reason}</p> : null}

            {report.sampling_stats ? (
              <div className="confidence-strip" style={{ marginBottom: 20 }}>
                <div className="confidence-detail">
                  <span>Judge Agent 五次采样</span>
                  <div className="confidence-scores">
                    {report.sampling_stats.scores.map((sc, i) => (
                      <span key={i} className="confidence-score-chip">{sc}</span>
                    ))}
                  </div>
                </div>
                <div className="confidence-bar-wrap">
                  <div className="confidence-bar">
                    <div
                      className={`confidence-bar-fill ${conf!.cls}`}
                      style={{ width: `${Math.min(100, (report.sampling_stats.variance / 120) * 100)}%` }}
                    />
                  </div>
                  <span>方差 {report.sampling_stats.variance} · {conf!.label}</span>
                </div>
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)", gap: 20 }}>
              <div className="dim-bars">
                {sortedDims.map(([key, value]) => {
                  const pct = Math.round((value / 20) * 100);
                  const color = getDimensionColor(dimKeys, key);
                  return (
                    <div className="dim-bar-row" key={key}>
                      <div className="dim-bar-head">
                        <span>{getDimensionLabel(key)}</span>
                        <strong style={{ color }}>{value}<small>/20</small></strong>
                      </div>
                      <div className="dim-bar-track">
                        <div className="dim-bar-fill" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="radar-card">
                <h3 className="section-heading">本次情境中的行为证据分布</h3>
                <RadarChart data={report.radar_chart_data} />
              </div>
            </div>

            <div className="dim-analysis-grid" style={{ marginTop: 16 }}>
              {Object.entries(report.dimension_analysis).map(([key, analysis]) => {
                const color = getDimensionColor(dimKeys, key);
                return (
                  <article className="dim-analysis-card" key={key} style={{ borderLeftColor: color }}>
                    <span className="dim-analysis-label" style={{ color }}>{getDimensionLabel(key)}</span>
                    <p>{analysis}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="admin-card" style={{ marginTop: 16 }}>
            <div className="report-copy">
              <div className="report-section">
                <h3>能力优势</h3>
                <ul>{report.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
              </div>
              <div className="report-section">
                <h3>发展关注点</h3>
                <ul>{report.risks.map((item, i) => <li key={i}>{item}</li>)}</ul>
              </div>
              <div className="report-section">
                <h3>改进建议</h3>
                <ul>{report.suggestions.map((item, i) => <li key={i}>{item}</li>)}</ul>
              </div>
            </div>
          </section>

          <section className="admin-card" style={{ marginTop: 16 }}>
            <h2>关键证据链</h2>
            <div className="evidence-grid">
              {report.evidence.map((item, i) => {
                const color = getDimensionColor(dimKeys, item.dimension);
                return (
                  <article className="evidence-card" key={i} style={{ borderLeftColor: color }}>
                    <span className="evidence-dim-tag" style={{ color, background: `${color}10` }}>
                      {getDimensionLabel(item.dimension)}
                    </span>
                    <blockquote>{item.quote}</blockquote>
                    <p>{item.analysis}</p>
                  </article>
                );
              })}
            </div>
          </section>

          {report.final_recommendation ? (
            <section className="admin-card" style={{ marginTop: 16 }}>
              <h2>发展建议</h2>
              <p className="muted">{report.final_recommendation}</p>
            </section>
          ) : null}
        </>
      ) : (
        <section className="admin-card" style={{ marginTop: 20 }}>
          <h2>报告</h2>
          <p className="muted">
            {s.status === "scoring_failed"
              ? "评分服务暂时不可用，请稍后重试。"
              : s.status === "finished"
                ? "报告数据缺失。"
                : "会话尚未结束，报告将在测评完成后生成。"}
          </p>
        </section>
      )}

      <section className="admin-card" style={{ marginTop: 16 }}>
        <h2>会话回放</h2>
        <SessionReplay messages={detail.messages} />
      </section>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <h2>群聊记录</h2>
        <GroupDiscussionPanel discussions={detail.group_discussions} />
      </section>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "1.05rem" }}>黑板状态（原始数据）</summary>
          <pre style={{ marginTop: 12 }}>{JSON.stringify(detail.session.blackboardState, null, 2)}</pre>
        </details>
      </section>
    </>
  );
}










