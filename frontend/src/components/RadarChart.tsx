import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer
} from "recharts";
import type { Report } from "../types/assessment";

const dimensionMaxScore = 20;

export function RadarChart({ data }: { data: Report["radar_chart_data"] }) {
  const normalizedData = data.map((item) => ({
    ...item,
    score: Math.max(0, Math.min(dimensionMaxScore, item.score))
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsRadarChart data={normalizedData}>
        <PolarGrid stroke="rgba(26, 27, 22, 0.18)" />
        <PolarAngleAxis dataKey="name" tick={{ fill: "#3f3b33", fontSize: 12 }} />
        <PolarRadiusAxis angle={90} domain={[0, dimensionMaxScore]} tickCount={5} tick={{ fill: "#7a7164", fontSize: 10 }} />
        <Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
