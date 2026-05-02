import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listScenarios, startAssessment } from "../api/assessment.api";
import { getScenarioPresentation, getScenarioSceneStyle } from "../config/scenarioPresentation";
import type { Scenario } from "../types/assessment";

const NICKNAME_KEY = "maat_nickname";

function getStoredNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeNickname(value: string) {
  try {
    localStorage.setItem(NICKNAME_KEY, value);
  } catch {
    // ignore
  }
}

export function ScenarioPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [nickname, setNickname] = useState(getStoredNickname);
  const [nicknameError, setNicknameError] = useState(false);

  useEffect(() => {
    listScenarios()
      .then(setScenarios)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleNicknameChange(value: string) {
    setNickname(value);
    storeNickname(value);
    if (nicknameError && value.trim()) {
      setNicknameError(false);
    }
  }

  async function start(scenarioId: string) {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setNicknameError(true);
      return;
    }

    setStartingId(scenarioId);
    setError(null);
    try {
      const result = await startAssessment({ scenario_id: scenarioId, nickname: trimmedNickname });
      navigate(`/chat/${result.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动失败");
    } finally {
      setStartingId(null);
    }
  }

  return (
    <main className="page-shell case-wall">
      <div className="page-heading">
        <span className="section-label">Assessment Scenarios</span>
        <h1>选择情境档案</h1>
        <p>
          每份档案对应一个真实职场压力场景。系统会指派多名 Agent 轮番追问，
          Orchestrator Agent 根据你的回答选择下一轮追问对象与压力点。没有预设正确答案，没有固定剧本。
        </p>
      </div>

      {loading ? <p className="loading-state">加载场景中...</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      <div className={`nickname-bar ${nicknameError ? "nickname-bar-error" : ""}`}>
        <label htmlFor="nickname">
          你的昵称
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          onChange={(e) => handleNicknameChange(e.target.value)}
          placeholder="输入你在测评中显示的名字"
          maxLength={16}
        />
        {nicknameError ? (
          <span>请先输入昵称</span>
        ) : null}
      </div>

      <div className="scenario-grid">
        {scenarios.map((scenario) => {
          const presentation = getScenarioPresentation(scenario);

          return (
            <article
              className="scenario-card"
              key={scenario.id}
              style={getScenarioSceneStyle(scenario)}
            >
              <div className="case-label">SCENARIO FILE</div>
              <div>
                <div className="scenario-card-top">
                  <span className="tech-label">{presentation.badge}</span>
                  <span className="data-badge">{scenario.maxRound} 轮上限</span>
                </div>
                <h2>{scenario.title}</h2>
                <p>{scenario.description}</p>
              </div>
              <div className="scenario-foot">
                <span>{presentation.tagline}</span>
                <button disabled={startingId === scenario.id} onClick={() => start(scenario.id)}>
                  {startingId === scenario.id ? "启动中..." : "开始测评"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

