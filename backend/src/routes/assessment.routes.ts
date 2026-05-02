import { Router } from "express";
import {
  getAssessmentReportController,
  getSessionController,
  listScenariosController,
  sendMessageController,
  sendMessageStreamController,
  startAssessmentController
} from "../controllers/assessment.controller";
import { asyncHandler } from "../utils/asyncHandler";

export const assessmentRouter = Router();

assessmentRouter.get("/scenarios", asyncHandler(listScenariosController));
assessmentRouter.post("/start", asyncHandler(startAssessmentController));
assessmentRouter.post("/message", asyncHandler(sendMessageController));
assessmentRouter.post("/message/stream", sendMessageStreamController);
assessmentRouter.get("/session/:sessionId", asyncHandler(getSessionController));
assessmentRouter.get("/report/:sessionId", asyncHandler(getAssessmentReportController));

