import { useEffect, useMemo, useState } from "react";
import { listSessions } from "../../api/admin.api";
import { SessionTable } from "../../components/admin/SessionTable";
import type { AdminSession } from "../../types/admin";

const statusLabel: Record<string, string> = {
  running: "进行中",
  finished: "已完成",
  abandoned: "已超时"
};

export function SessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scenarioFilter, setScenarioFilter] = useState("all");

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const scenarioOptions = useMemo(() => {
    const unique = new Map<string, string>();
    sessions.forEach((session) => {
      unique.set(session.scenario.id, session.scenario.title);
    });
    return Array.from(unique, ([id, title]) => ({ id, title }));
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return sessions.filter((session) => {
      const matchesStatus = statusFilter === "all" || session.status === statusFilter;
      const matchesScenario = scenarioFilter === "all" || session.scenario.id === scenarioFilter;
      const matchesKeyword = Boolean(
        !keyword ||
          session.id.toLowerCase().includes(keyword) ||
          session.scenario.title.toLowerCase().includes(keyword) ||
          session.user?.nickname?.toLowerCase().includes(keyword)
      );

      return matchesStatus && matchesScenario && matchesKeyword;
    });
  }, [query, scenarioFilter, sessions, statusFilter]);

  const completedCount = sessions.filter((session) => session.status === "finished").length;
  const runningCount = sessions.filter((session) => session.status === "running").length;

  return (
    <>
      <div className="admin-heading">
        <span>Replay</span>
        <h1>会话记录</h1>
      </div>
      {error ? <p className="error-box">{error}</p> : null}

      <section className="session-console" aria-label="会话筛选">
        <div className="session-console-summary">
          <div>
            <span>全部</span>
            <strong>{sessions.length}</strong>
          </div>
          <div>
            <span>进行中</span>
            <strong>{runningCount}</strong>
          </div>
          <div>
            <span>已完成</span>
            <strong>{completedCount}</strong>
          </div>
        </div>

        <div className="session-filter-grid">
          <label>
            搜索
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="会话 ID、场景或昵称"
            />
          </label>
          <label>
            状态
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">全部状态</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            场景
            <select value={scenarioFilter} onChange={(event) => setScenarioFilter(event.target.value)}>
              <option value="all">全部场景</option>
              {scenarioOptions.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? <p className="loading-state">正在读取会话...</p> : null}
      <SessionTable sessions={filteredSessions} />
    </>
  );
}
