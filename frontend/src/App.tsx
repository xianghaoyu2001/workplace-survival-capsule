import { lazy, Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { AdminGate } from "./components/AdminGate";
import { ErrorBoundary } from "./components/ErrorBoundary";

const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const ScenarioPage = lazy(() => import("./pages/ScenarioPage").then((m) => ({ default: m.ScenarioPage })));
const ChatPage = lazy(() => import("./pages/ChatPage").then((m) => ({ default: m.ChatPage })));
const ReportPage = lazy(() => import("./pages/ReportPage").then((m) => ({ default: m.ReportPage })));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const DashboardPage = lazy(() => import("./pages/admin/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ScenariosPage = lazy(() => import("./pages/admin/ScenariosPage").then((m) => ({ default: m.ScenariosPage })));
const PromptsPage = lazy(() => import("./pages/admin/PromptsPage").then((m) => ({ default: m.PromptsPage })));
const SessionsPage = lazy(() => import("./pages/admin/SessionsPage").then((m) => ({ default: m.SessionsPage })));
const SessionDetailPage = lazy(() =>
  import("./pages/admin/SessionDetailPage").then((m) => ({ default: m.SessionDetailPage }))
);

export function App() {
  return (
    <ErrorBoundary>
      <header className="topbar">
        <NavLink to="/" className="logo">
          <span className="logo-mark">MA</span>
          <span>
            <strong>职场情境能力评估系统</strong>
            <small>Generative LLM Multi-Agent</small>
          </span>
        </NavLink>
        <nav aria-label="主导航">
          <NavLink to="/scenarios">场景</NavLink>
          <NavLink to="/admin">后台</NavLink>
        </nav>
      </header>
      <Suspense fallback={<main className="page-shell"><div className="skeleton-panel">正在加载页面...</div></main>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scenarios" element={<ScenarioPage />} />
          <Route path="/chat/:sessionId" element={<ChatPage />} />
          <Route path="/report/:sessionId" element={<ReportPage />} />
          <Route path="/admin" element={<AdminGate><AdminLayout /></AdminGate>}>
            <Route index element={<DashboardPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="prompts" element={<PromptsPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
