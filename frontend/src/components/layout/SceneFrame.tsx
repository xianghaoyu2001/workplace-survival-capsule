import type { ReactNode } from "react";
import { getScenarioSceneStyle, type ScenarioPresentationInput } from "../../config/scenarioPresentation";

export function SceneFrame({
  scenarioId,
  className = "",
  children
}: {
  scenarioId?: ScenarioPresentationInput | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main className={`scene-frame ${className}`} style={getScenarioSceneStyle(scenarioId)}>
      <div className="scene-background" aria-hidden="true" />
      <div className="scene-content">{children}</div>
    </main>
  );
}
