import type { CSSProperties } from "react";
import projectDemoImage from "../assets/scenarios/project-demo.svg";
import restaurantDishImage from "../assets/scenarios/restaurant-dish.svg";

export interface ScenarioPresentation {
  badge: string;
  tagline: string;
  backgroundImage: string;
  accent: string;
  accentRgb: string;
}

type SceneStyle = CSSProperties & Record<`--${string}`, string>;
export type ScenarioPresentationInput =
  | string
  | {
      id?: string | null;
      title?: string | null;
      description?: string | null;
      backgroundForUser?: string | null;
    };

const defaultPresentation: ScenarioPresentation = {
  badge: "综合压力",
  tagline: "Multi-Agent 动态追问 · 多维度行为观察",
  backgroundImage: projectDemoImage,
  accent: "#b63f2e",
  accentRgb: "182, 63, 46"
};

const scenarioPresentations: Record<string, ScenarioPresentation> = {
  project_demo_crisis: {
    badge: "会议室压力",
    tagline: "信息辨别 · 交付切分 · 备选方案 · 压力表达",
    backgroundImage: projectDemoImage,
    accent: "#b63f2e",
    accentRgb: "182, 63, 46"
  },
  coffee_shop_complaint: {
    badge: "人情危机",
    tagline: "利害识别 · 现场止损 · 面子修复 · 系统改进",
    backgroundImage: restaurantDishImage,
    accent: "#8d5f26",
    accentRgb: "141, 95, 38"
  }
};

const scenarioAliases: Record<string, keyof typeof scenarioPresentations> = {
  project_demo: "project_demo_crisis",
  project_demo_crisis: "project_demo_crisis",
  project_demo_case: "project_demo_crisis",
  meeting_room_crisis: "project_demo_crisis",
  wednesday_meeting_room: "project_demo_crisis",
  q3_design_gap: "project_demo_crisis",
  q3_report_crisis: "project_demo_crisis",
  coffee_shop_complaint: "coffee_shop_complaint",
  restaurant_complaint: "coffee_shop_complaint",
  restaurant_dish: "coffee_shop_complaint",
  table_8_complaint: "coffee_shop_complaint"
};

function normalizeScenarioToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function resolveDirectKey(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizeScenarioToken(value);
  return scenarioPresentations[normalized] ? normalized : scenarioAliases[normalized] ?? null;
}

function resolveKeyFromSearchableText(searchable: string) {
  const normalized = searchable.toLowerCase();

  if (/8号桌|刘总|珍味轩|餐厅|后厨|菜品|江师傅|小林/.test(searchable)) {
    return "coffee_shop_complaint";
  }

  if (/\b(table[_\s-]?8|restaurant|dish|chef|kitchen|complaint)\b/.test(normalized)) {
    return "coffee_shop_complaint";
  }

  if (/周三下午|会议室|陈总|VP|CEO|Q3|设计稿|assumption|汇报|小秋|苏姐/.test(searchable)) {
    return "project_demo_crisis";
  }

  if (/\b(q3|vp|ceo|meeting|deck|design[_\s-]?gap|assumption|owner)\b/.test(normalized)) {
    return "project_demo_crisis";
  }

  return null;
}

function resolveScenarioKey(input?: ScenarioPresentationInput | null) {
  if (!input) {
    return null;
  }

  if (typeof input === "string") {
    return resolveDirectKey(input) ?? resolveKeyFromSearchableText(input);
  }

  const directKey = resolveDirectKey(input.id);
  if (directKey) {
    return directKey;
  }

  const searchable = [
    input.id,
    input.title,
    input.description,
    input.backgroundForUser
  ]
    .filter(Boolean)
    .join(" ");

  return resolveKeyFromSearchableText(searchable);
}

export function getScenarioPresentation(input?: ScenarioPresentationInput | null) {
  const key = resolveScenarioKey(input);
  return key ? scenarioPresentations[key] : defaultPresentation;
}

export function getScenarioSceneStyle(input?: ScenarioPresentationInput | null): SceneStyle {
  const presentation = getScenarioPresentation(input);
  const accentLight = `rgba(${presentation.accentRgb}, 0.08)`;
  const accentGlow = `rgba(${presentation.accentRgb}, 0.2)`;

  return {
    "--accent": presentation.accent,
    "--accent-rgb": presentation.accentRgb,
    "--accent-deep": presentation.accent,
    "--accent-light": accentLight,
    "--accent-glow": accentGlow,
    "--scene-image": `url(${presentation.backgroundImage})`,
    "--scene-accent": presentation.accent,
    "--scene-accent-rgb": presentation.accentRgb,
    "--scenario-image": `url(${presentation.backgroundImage})`
  };
}

