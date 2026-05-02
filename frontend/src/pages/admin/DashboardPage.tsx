import { useEffect, useState } from "react";
import { getDashboard } from "../../api/admin.api";
import { getDimensionLabel } from "../../config/dimensions";
import type { DashboardData } from "../../types/admin";

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <>
      <div className="admin-heading">
        <span>Admin</span>
        <h1>仪表盘</h1>
      </div>
      {error ? <p className="error-box">{error}</p> : null}
      <div className="metric-grid">
        <article>
          <span>总会话</span>
          <strong>{data?.total_sessions ?? "-"}</strong>
        </article>
        <article>
          <span>进行中</span>
          <strong>{data?.running_sessions ?? "-"}</strong>
        </article>
        <article>
          <span>已完成</span>
          <strong>{data?.completed_sessions ?? "-"}</strong>
        </article>
        <article>
          <span>平均参考指数</span>
          <strong>{data?.average_score ?? "-"}</strong>
        </article>
      </div>
      <section className="admin-card">
        <h2>维度均分</h2>
        <div className="dimension-bars">
          {Object.entries(data?.average_dimension_scores ?? {}).map(([key, value]) => {
            const percent = Math.min(100, Math.round((value / 20) * 100));

            return (
              <div className="dimension-bar-row" key={key}>
                <div>
                  <span>{getDimensionLabel(key)}</span>
                  <strong>{value}/20</strong>
                </div>
                <div className="score-track">
                  <div className="score-fill" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
          {data && !Object.keys(data.average_dimension_scores).length ? <p className="muted">暂无已完成会话。</p> : null}
        </div>
      </section>
    </>
  );
}



