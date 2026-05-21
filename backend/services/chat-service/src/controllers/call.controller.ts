import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { CallService } from "../services/call.service.js";

const callService = new CallService();

export class CallController {
  static async start(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const conversationId =
        typeof req.body.conversation_id === "string"
          ? req.body.conversation_id
          : "";
      const callType =
        req.body.call_type === "group" ? ("group" as const) : ("direct" as const);
      const callId =
        typeof req.body.call_id === "string" && req.body.call_id.length > 0
          ? req.body.call_id
          : randomUUID();

      const data = await callService.startCall({
        call_id: callId,
        conversation_id: conversationId,
        initiator_id: userId,
        call_type: callType,
      });

      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async end(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const callId = req.params.callId;
      const conversationId =
        typeof req.body.conversation_id === "string"
          ? req.body.conversation_id
          : "";
      const reason =
        typeof req.body.reason === "string" && req.body.reason.length > 0
          ? req.body.reason
          : "ended_by_user";

      const data = await callService.endCall(
        callId,
        userId,
        conversationId,
        reason,
      );

      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async leave(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const callId = req.params.callId;
      const conversationId =
        typeof req.body.conversation_id === "string"
          ? req.body.conversation_id
          : "";

      const data = await callService.leaveCall(callId, userId, conversationId);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async history(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const rawLimit = Number(req.query.limit ?? 50);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 200)
        : 50;
      const data = await callService.listHistory(userId, limit);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async active(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const data = await callService.listActive(userId);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async activeForConversation(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const conversationId =
        typeof req.query.conversation_id === "string"
          ? req.query.conversation_id
          : "";
      if (!conversationId) {
        res.status(400).json({ error: "conversation_id is required" });
        return;
      }

      const userId = req.auth?.userId ?? "";
      const data = await callService.getActiveCallForConversationForUser(
        conversationId,
        userId,
      );
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async liveKitToken(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId ?? "";
      const callId = req.params.callId;
      const conversationId =
        typeof req.body.conversation_id === "string"
          ? req.body.conversation_id
          : "";

      const data = await callService.issueLiveKitToken({
        callId,
        conversationId,
        userId,
      });

      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }
}
