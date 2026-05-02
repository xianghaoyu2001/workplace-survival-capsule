import { Link } from "react-router-dom";
import projectDemoArt from "../assets/scenarios/project-demo.svg";
import restaurantDishArt from "../assets/scenarios/restaurant-dish.svg";

export function HomePage() {
  return (
    <main className="home-shell command-home">
      <section className="hero-grid" aria-labelledby="home-title">
        <div className="hero-main stagger-in">
          <span className="section-label">Generative LLM Multi-Agent assessment system</span>
          <h1 id="home-title">
            <span>基于生成式大模型 Multi-Agent 的</span>
            <em>职场情境能力评估系统</em>
          </h1>
          <p className="hero-desc">
            这是一个情境模拟反馈诊断系统。用户进入会议室、餐厅等职场压力情境，与多个 Agent 对话；
            系统保留用户原话，抽取行为证据，并在证据不足或采样分歧过大时输出观察反馈。
          </p>
          <div className="hero-actions">
            <Link to="/scenarios" className="btn-primary">
              进入评估情境
            </Link>
            <Link to="/admin" className="btn-ghost">
              查看管理端
            </Link>
          </div>
        </div>

        <aside className="hero-visual" aria-label="情境入口预览">
          <div className="assessment-board">
            <div className="assessment-board-head">
              <span>示例评估情境</span>
              <strong>02</strong>
            </div>
            <Link to="/scenarios" className="case-preview case-preview-primary">
              <img src={projectDemoArt} alt="会议室情境预览" />
              <span>周三下午的会议室</span>
            </Link>
            <Link to="/scenarios" className="case-preview case-preview-secondary">
              <img src={restaurantDishArt} alt="餐厅情境预览" />
              <span>8号桌的客人</span>
            </Link>
            <div className="instrument-strip" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </aside>
      </section>

      <section className="workflow-section" aria-labelledby="workflow-title">
        <div className="workflow-header">
          <span className="section-label">Agent workflow</span>
          <h2 id="workflow-title">一次回答如何触发下一轮追问</h2>
          <p>
            用户每次回应都会进入证据抽取、覆盖检查和下一轮调度。Role Agent 只看到当前情境和本轮指令，
            Judge Agent 在结束后汇总行为证据、采样方差和发展建议。
          </p>
        </div>

        <ol className="workflow-map">
          <li className="workflow-step workflow-step-input">
            <span className="workflow-index">00</span>
            <h3>用户回应</h3>
            <p>记录原话、轮次和发言对象，保留真实表达。</p>
            <small>User reply</small>
          </li>
          <li className="workflow-step">
            <span className="workflow-index">01</span>
            <h3>Evidence Agent</h3>
            <p>抽取事实核实、边界表达、方案选择、冲突安抚等行为证据。</p>
            <small>Evidence</small>
          </li>
          <li className="workflow-step">
            <span className="workflow-index">02</span>
            <h3>Coverage check</h3>
            <p>检查哪些维度已有证据，哪些维度仍需要继续观察。</p>
            <small>Coverage</small>
          </li>
          <li className="workflow-step workflow-step-control">
            <span className="workflow-index">03</span>
            <h3>Orchestrator Agent</h3>
            <p>根据待观察维度选择下一位 Role Agent 和压力点。</p>
            <small>Dispatch</small>
          </li>
          <li className="workflow-step">
            <span className="workflow-index">04</span>
            <h3>Role Agent</h3>
            <p>按公开情境和本轮指令追问，不读取评分细则或参考答案。</p>
            <small>Role play</small>
          </li>
          <li className="workflow-step workflow-step-final">
            <span className="workflow-index">05</span>
            <h3>Observation report</h3>
            <p>Judge Agent 汇总证据、覆盖情况、采样方差和发展建议。</p>
            <small>Judge Agent</small>
          </li>
        </ol>
      </section>

      <section className="concept-strip" aria-labelledby="concept-title">
        <div className="concept-heading">
          <span className="section-label">Interpretability</span>
          <h2 id="concept-title">报告如何保持可解释</h2>
          <p>每个结论都尽量回到用户原话、行为证据和覆盖状态，方便判断报告边界。</p>
        </div>
        <div className="concept-grid">
          <article className="concept-card">
            <strong>Observation point</strong>
            <p>某个维度需要看到的行为证据，例如事实核实、边界表达、备选方案。</p>
          </article>
          <article className="concept-card">
            <strong>Evidence coverage</strong>
            <p>报告标出已覆盖维度和证据不足维度，方便判断结论边界。</p>
          </article>
          <article className="concept-card">
            <strong>Prompt isolation</strong>
            <p>Role Agent 和 Orchestrator Agent 不读取评分细则、参考答案或最终报告要求。</p>
          </article>
          <article className="concept-card">
            <strong>Reliability gate</strong>
            <p>回答过少、证据不足或采样分歧过大时，系统只输出观察反馈。</p>
          </article>
        </div>
      </section>

      <section className="quality-gates" aria-labelledby="quality-title">
        <div className="quality-heading">
          <span className="section-label">Control layers</span>
          <h2 id="quality-title">从对话到报告的三层约束</h2>
        </div>
        <div className="quality-board">
          <article className="quality-gate">
            <span className="quality-code">A</span>
            <div>
              <h3>Prompt isolation</h3>
              <p>参考答案和评分细则只进入 Judge Agent 视图，不进入 Role Agent / Orchestrator Agent。</p>
            </div>
          </article>
          <article className="quality-gate">
            <span className="quality-code">B</span>
            <div>
              <h3>Evidence first</h3>
              <p>报告先展示用户原话和对应分析，再呈现参考指数、覆盖情况和采样方差。</p>
            </div>
          </article>
          <article className="quality-gate">
            <span className="quality-code">C</span>
            <div>
              <h3>Reliability gate</h3>
              <p>证据不足、回答过少或采样分歧过大时，结果降级为观察反馈。</p>
            </div>
          </article>
        </div>
      </section>

      <p className="footer-note">
        基于生成式大模型 Multi-Agent 的职场情境能力评估系统 · Evidence first · Reliability gate
      </p>
    </main>
  );
}
