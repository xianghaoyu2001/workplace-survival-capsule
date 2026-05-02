import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getReport } from "../api/assessment.api";
import { RadarChart } from "../components/RadarChart";
import { ReportSection } from "../components/ReportSection";
import { getDimensionColor, getDimensionLabel } from "../config/dimensions";
import type { Report } from "../types/assessment";

function confidenceLevel(variance: number) {
  if (variance < 30) return { label: "高可信", cls: "conf-high" };
  if (variance < 80) return { label: "中可信", cls: "conf-mid" };
  return { label: "建议人工复核", cls: "conf-low" };
}

function statusMeta(report: Report) {
  if (report.report_status === "scoring_failed") {
    return {
      label: "评分失败",
      cls: "conf-low",
      note: "评分服务暂时不可用，请稍后重试。"
    };
  }
  if (report.report_status === "debug" || report.mock_generated) {
    return {
      label: "调试报告",
      cls: "conf-low",
      note: "本报告由本地 mock Judge Agent 生成，仅用于调试。"
    };
  }
  if (report.report_status === "unratable") {
    return {
      label: "仅观察反馈",
      cls: "conf-low",
      note: "Judge Agent 采样分歧过大，当前结果仅保留为观察记录。"
    };
  }
  if (report.report_status === "provisional") {
    return {
      label: "观察性反馈",
      cls: "conf-mid",
      note: "观察点覆盖不足，参考指数仅作发展反馈，不建议横向比较。"
    };
  }
  return {
    label: "本次观察结果",
    cls: "conf-high",
    note: "当前报告通过采样和覆盖检查，可作为本次模拟测评的参考结果。"
  };
}

function scoringFailureReason(report: Report) {
  return report.scoring_error_reason ?? report.reason ?? report.human_review_reason ?? "评分服务暂时不可用，请稍后重试。";
}

export function ReportPage() {
  const { sessionId } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    getReport(sessionId)
      .then(setReport)
      .catch((err: Error) => setError(err.message));
  }, [sessionId]);

  if (error) {
    return (
      <main className="page-shell">
        <p className="error-box">{error}</p>
        <Link to="/scenarios" className="btn-ghost">返回场景列表</Link>
      </main>
    );
  }

  if (!report) {
    return <main className="page-shell loading-state">正在生成评估报告...</main>;
  }

  if (report.report_status === "scoring_failed") {
    const status = statusMeta(report);
    return (
      <main className="report-shell">
        <section className="report-hero">
          <div>
            <span className="section-label">Behavior Observation</span>
            <h1>评分服务暂时不可用</h1>
            <p>{scoringFailureReason(report)}</p>
            <div className="report-hero-tags">
              <span className={`confidence-pill ${status.cls}`} title={status.note}>{status.label}</span>
              <span className="tech-label">未生成参考指数</span>
            </div>
            <p className="report-status-note">对话记录已保留，可稍后重新进入报告页查看结果。</p>
            <Link to="/scenarios" className="btn-ghost" style={{ marginTop: 16, display: "inline-flex" }}>
              返回场景列表
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const conf = report.sampling_stats ? confidenceLevel(report.sampling_stats.variance) : null;
  const status = statusMeta(report);
  const sortedDims = Object.entries(report.dimension_scores).sort((a, b) => b[1] - a[1]);
  const dimKeys = Object.keys(report.dimension_scores);
  const maxScore = dimKeys.length * 20;
  const calibrationIssues = report.calibration_issues ?? [];
  const reviewReasons = [report.human_review_reason, ...calibrationIssues].filter(Boolean);
  const coverage = report.coverage_status;
  const coveredCount = coverage?.covered_dimensions.length ?? 0;
  const totalCoverageCount = coverage ? coverage.covered_dimensions.length + coverage.insufficient_dimensions.length : 0;
  const formalScore = report.report_status === "confident" && !report.mock_generated;

  return (
    <main className="report-shell">
      <section className="report-hero">
        <div>
          <span className="section-label">Behavior Observation</span>
          <h1>观察区间 · {report.level}</h1>
          <p>{report.summary}</p>
          <div className="report-hero-tags">
            <span className={`confidence-pill ${status.cls}`} title={status.note}>{status.label}</span>
            <span className="tech-label">冲突风格 · {report.conflict_style}</span>
            {conf ? (
              <span className={`confidence-pill ${conf.cls}`} title={`采样结果: [${report.sampling_stats!.scores.join(", ")}] · 方差: ${report.sampling_stats!.variance}`}>
                {conf.label} · σ²={report.sampling_stats!.variance}
              </span>
            ) : null}
            {coverage ? (
              <span className={`confidence-pill ${coverage.complete ? "conf-high" : "conf-mid"}`}>
                观察点覆盖 {coveredCount}/{totalCoverageCount}
              </span>
            ) : null}
          </div>
          <p className="report-status-note">{status.note}</p>
          {reviewReasons.length ? <p className="report-status-note">{reviewReasons.join(" · ")}</p> : null}
          <Link to="/scenarios" className="btn-ghost" style={{ marginTop: 16, display: "inline-flex" }}>
            重新测评
          </Link>
        </div>
        <div className={`total-score ${formalScore ? "" : "total-score-muted"}`}>
          <strong>{report.total_score}</strong>
          <span>参考指数 / {maxScore}</span>
        </div>
      </section>

      {report.sampling_stats ? (
        <section className="confidence-strip" aria-label="采样一致性">
          <div className="confidence-detail">
            <span>Judge Agent 五次采样</span>
            <div className="confidence-scores">
              {report.sampling_stats.scores.map((s, i) => (
                <span key={i} className="confidence-score-chip">{s}</span>
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
        </section>
      ) : null}

      {coverage ? (
        <section className="coverage-strip">
          <div>
            <strong>已观察维度</strong>
            <span>{coverage.covered_dimensions.length ? coverage.covered_dimensions.join("、") : "暂无"}</span>
          </div>
          <div>
            <strong>证据不足维度</strong>
            <span>{coverage.insufficient_dimensions.length ? coverage.insufficient_dimensions.join("、") : "无"}</span>
          </div>
        </section>
      ) : null}

      <section className="report-grid">
        <div className="dim-bars">
          <h3 className="section-heading">各维度行为证据强度</h3>
          {sortedDims.map(([key, value]) => {
            const pct = Math.round((value / 20) * 100);
            const color = getDimensionColor(dimKeys, key);
            const dimVar = report.sampling_stats?.dim_variances?.[key];
            return (
              <div className="dim-bar-row" key={key}>
                <div className="dim-bar-head">
                  <span>{getDimensionLabel(key)}</span>
                  <strong style={{ color }}>{value}<small>/20</small></strong>
                </div>
                <div className="dim-bar-track">
                  <div className="dim-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                {dimVar !== undefined ? (
                  <span className="dim-var-chip" title={`5样本方差: ${dimVar}`}>σ²{dimVar}</span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="radar-card">
          <h3 className="section-heading">本次情境中的行为证据分布</h3>
          <RadarChart data={report.radar_chart_data} />
        </div>
      </section>

      <section className="dim-analysis-section" style={{ marginTop: 20 }}>
        <h3 className="section-heading">维度分析</h3>
        <div className="dim-analysis-grid">
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

      <section className="report-copy">
        <ReportSection title="能力优势" items={report.strengths} />
        <ReportSection title="发展关注点" items={report.risks} />
        <ReportSection title="改进建议" items={report.suggestions} />
      </section>

      <section style={{ marginTop: 20 }}>
        <h3 className="section-heading" style={{ marginBottom: 14 }}>关键证据</h3>
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

      <section className="final-card" style={{ marginTop: 20 }}>
        <h3>发展建议</h3>
        <p>{report.final_recommendation}</p>
      </section>
    </main>
  );
}











