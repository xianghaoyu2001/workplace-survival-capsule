import type { Request, Response } from "express";
import {
  getDashboardData,
  getSessionDetail,
  listPrompts,
  listScenarios,
  listSessions,
  updatePrompt,
  updateScenario
} from "../services/admin.service";

export async function getDashboardController(_req: Request, res: Response) {
  res.json(await getDashboardData());
}

export async function listScenariosController(_req: Request, res: Response) {
  res.json(await listScenarios());
}

export async function updateScenarioController(req: Request, res: Response) {
  res.json(await updateScenario(req.params.id, req.body));
}

export async function listPromptsController(_req: Request, res: Response) {
  res.json(await listPrompts());
}

export async function updatePromptController(req: Request, res: Response) {
  res.json(await updatePrompt(req.params.key, req.body));
}

export async function listSessionsController(_req: Request, res: Response) {
  res.json(await listSessions());
}

export async function getSessionDetailController(req: Request, res: Response) {
  res.json(await getSessionDetail(req.params.id));
}

