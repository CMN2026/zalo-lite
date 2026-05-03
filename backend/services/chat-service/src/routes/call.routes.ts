import { Router } from "express";
import { body, param, query } from "express-validator";
import { CallController } from "../controllers/call.controller.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

export const callRoutes = Router();

callRoutes.post(
  "/start",
  [
    body("conversation_id").isString().notEmpty(),
    body("call_type").isIn(["direct", "group"]),
    body("call_id").optional().isString(),
    validateRequest,
  ],
  CallController.start,
);

callRoutes.post(
  "/:callId/end",
  [
    param("callId").isString().notEmpty(),
    body("conversation_id").isString().notEmpty(),
    body("reason").optional().isString(),
    validateRequest,
  ],
  CallController.end,
);

callRoutes.post(
  "/:callId/livekit-token",
  [
    param("callId").isString().notEmpty(),
    body("conversation_id").isString().notEmpty(),
    validateRequest,
  ],
  CallController.liveKitToken,
);

callRoutes.get(
  "/history",
  [query("limit").optional().isInt({ min: 1, max: 200 }), validateRequest],
  CallController.history,
);

callRoutes.get("/active", CallController.active);
