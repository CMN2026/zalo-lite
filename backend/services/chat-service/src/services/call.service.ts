import { HttpError } from "../utils/http-error.js";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { UserClientService } from "./user-client.service.js";
import {
  CallRepository,
  type CallHistoryItem,
  type CallParticipantState,
  type CallSession,
} from "../repositories/call.repository.js";

function formatCallDuration(seconds: number): string {
  if (seconds <= 0 || !Number.isFinite(seconds)) {
    return "";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} gi\u1EDD`);
  if (minutes > 0) parts.push(`${minutes} ph\u00FAt`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} gi\u00E2y`);

  return parts.join(" ");
}

type StartCallInput = {
  call_id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: "direct" | "group";
  started_at?: string;
};

export class CallService {
  private readonly callRepository = new CallRepository();

  private readonly conversationRepository = new ConversationRepository();

  private readonly messageRepository = new MessageRepository();

  private readonly userClient = new UserClientService(
    process.env.USER_SERVICE_BASE_URL || "http://localhost:3001",
  );

  async startCall(input: StartCallInput): Promise<CallSession> {
    const members = await this.conversationRepository.getConversationMembers(
      input.conversation_id,
    );

    const isMember = members.some((member) => member.userId === input.initiator_id);
    if (!isMember) {
      throw new HttpError(403, "not_a_member");
    }

    const activeCall = await this.callRepository.getActiveByConversationId(
      input.conversation_id,
    );
    if (activeCall) {
      throw new HttpError(409, "call_already_active");
    }

    const existing = await this.callRepository.getSessionById(input.call_id);
    if (existing) {
      return existing;
    }

    const startedAt = input.started_at ?? new Date().toISOString();

    const participants = members.map((member) => ({
      user_id: member.userId,
      state:
        member.userId === input.initiator_id
          ? ("initiated" as const)
          : ("invited" as const),
      joined_at: member.userId === input.initiator_id ? startedAt : undefined,
    }));

    const session: CallSession = {
      id: input.call_id,
      conversation_id: input.conversation_id,
      call_type: input.call_type,
      initiator_id: input.initiator_id,
      participants,
      participant_user_ids: participants.map((item) => item.user_id),
      status: "active",
      started_at: startedAt,
    };

    return this.callRepository.createSession(session);
  }

  async markParticipantState(
    callId: string,
    userId: string,
    conversationId: string,
    state: CallParticipantState,
  ): Promise<CallSession> {
    const session = await this.callRepository.getSessionById(callId);
    if (!session) {
      throw new HttpError(404, "call_not_found");
    }

    if (session.status !== "active") {
      throw new HttpError(409, "call_not_active");
    }

    if (session.conversation_id !== conversationId) {
      throw new HttpError(400, "conversation_mismatch");
    }

    const members = await this.conversationRepository.getConversationMembers(
      conversationId,
    );
    const isMember = members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new HttpError(403, "not_a_member");
    }

    const now = new Date().toISOString();
    let found = false;

    session.participants = session.participants.map((participant) => {
      if (participant.user_id !== userId) {
        return participant;
      }

      found = true;
      const next = {
        ...participant,
        state,
      };

      if (state === "connected" && !next.joined_at) {
        next.joined_at = now;
      }

      if ((state === "left" || state === "declined" || state === "missed") && !next.left_at) {
        next.left_at = now;
      }

      return next;
    });

    if (!found) {
      session.participants.push({
        user_id: userId,
        state,
        joined_at: state === "connected" ? now : undefined,
        left_at: (state === "left" || state === "declined" || state === "missed") ? now : undefined,
      });
      session.participant_user_ids.push(userId);
    }

    return this.callRepository.saveSession(session);
  }

  async endCall(
    callId: string,
    userId: string,
    conversationId: string,
    endReason: string,
    options?: { failIfEnded?: boolean },
  ): Promise<CallSession> {
    const session = await this.callRepository.getSessionById(callId);
    if (!session) {
      throw new HttpError(404, "call_not_found");
    }

    if (session.conversation_id !== conversationId) {
      throw new HttpError(400, "conversation_mismatch");
    }

    const members = await this.conversationRepository.getConversationMembers(
      conversationId,
    );
    const isMember = members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new HttpError(403, "not_a_member");
    }

    if (session.status === "ended") {
      if (options?.failIfEnded) {
        throw new HttpError(409, "call_already_ended");
      }
      return session;
    }

    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      0,
      Math.floor(
        (new Date(endedAt).getTime() - new Date(session.started_at).getTime()) /
          1000,
      ),
    );

    session.participants = session.participants.map((participant) => {
      if (
        participant.state !== "connected" &&
        participant.state !== "declined" &&
        participant.state !== "left"
      ) {
        return {
          ...participant,
          state: "missed",
          left_at: participant.left_at ?? endedAt,
        };
      }
      return {
        ...participant,
        left_at: participant.left_at ?? endedAt,
      };
    });

    session.status = "ended";
    session.ended_at = endedAt;
    session.duration_seconds = durationSeconds;
    session.end_reason = endReason;

    const saved = await this.callRepository.saveSession(session);
    const historyItems = this.buildHistoryItems(saved);
    await this.callRepository.appendHistory(historyItems);

    // ── Persist a call-info message into the conversation ────────────
    try {
      const hadConnection = saved.participants.some(
        (p) => p.state === "connected" || p.state === "left",
      );

      // Fetch initiator name for the call info message
      let callerName = "";
      try {
        const caller = await this.userClient.getUserById(session.initiator_id);
        callerName = caller.fullName || "";
      } catch {
        // Fallback: no name available
      }

      let callInfoText: string;
      if (hadConnection && durationSeconds > 0) {
        const durationStr = formatCallDuration(durationSeconds);
        callInfoText = callerName
          ? `\uD83D\uDCDE ${callerName} \u0111\u00E3 g\u1ECDi \u2022 ${durationStr}`
          : `\uD83D\uDCDE Cu\u1ED9c g\u1ECDi k\u1EBFt th\u00FAc \u2022 ${durationStr}`;
      } else {
        callInfoText = callerName
          ? `\uD83D\uDCDE Cu\u1ED9c g\u1ECDi nh\u1EE1 t\u1EEB ${callerName}`
          : "\uD83D\uDCDE Cu\u1ED9c g\u1ECDi nh\u1EE1";
      }

      const callInfoContent = JSON.stringify({
        text: callInfoText,
        call_id: callId,
        caller_name: callerName,
        duration_seconds: durationSeconds,
        end_reason: endReason,
        had_connection: hadConnection,
      });

      const callMessage = await this.messageRepository.create({
        conversation_id: conversationId,
        sender_id: session.initiator_id,
        type: "call",
        content: callInfoContent,
      });

      // Publish so the real-time socket layer broadcasts to all members
      const { redisPublisher } = await import("../config/redis.js");
      await redisPublisher.publish(
        env.REDIS_MESSAGE_CHANNEL,
        JSON.stringify(callMessage),
      );
    } catch (messageError) {
      // Don't fail the call end if message persistence fails.
      console.error("Failed to persist call-info message", messageError);
    }

    return saved;
  }

  /**
   * Leave a group call without ending it for everyone.
   * If fewer than 2 connected participants remain, auto-ends the call.
   */
  async leaveCall(
    callId: string,
    userId: string,
    conversationId: string,
  ): Promise<{ action: "participant_left" | "ended"; session: CallSession }> {
    const session = await this.callRepository.getSessionById(callId);
    if (!session) {
      throw new HttpError(404, "call_not_found");
    }

    if (session.conversation_id !== conversationId) {
      throw new HttpError(400, "conversation_mismatch");
    }

    if (session.status === "ended") {
      return { action: "ended", session };
    }

    const members = await this.conversationRepository.getConversationMembers(
      conversationId,
    );
    const isMember = members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new HttpError(403, "not_a_member");
    }

    // Mark the leaving participant
    const now = new Date().toISOString();
    session.participants = session.participants.map((participant) => {
      if (participant.user_id !== userId) {
        return participant;
      }
      return {
        ...participant,
        state: "left" as const,
        left_at: participant.left_at ?? now,
      };
    });

    await this.callRepository.saveSession(session);

    // Count participants still in the call (connected or initiated — not left/declined/missed)
    const activeParticipants = session.participants.filter(
      (p) => p.state === "connected" || p.state === "initiated",
    );

    if (activeParticipants.length < 2) {
      // Auto-end the call
      const endedSession = await this.endCall(
        callId,
        userId,
        conversationId,
        "last_participant_left",
      );
      return { action: "ended", session: endedSession };
    }

    return { action: "participant_left", session };
  }

  /**
   * Get the active call for a conversation, if any.
   */
  async getActiveCallForConversation(
    conversationId: string,
  ): Promise<CallSession | null> {
    return this.callRepository.getActiveByConversationId(conversationId);
  }

  async getActiveCallForConversationForUser(
    conversationId: string,
    userId: string,
  ): Promise<CallSession | null> {
    const members = await this.conversationRepository.getConversationMembers(
      conversationId,
    );
    const isMember = members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new HttpError(403, "not_a_member");
    }

    return this.callRepository.getActiveByConversationId(conversationId);
  }

  async listHistory(userId: string, limit: number): Promise<CallHistoryItem[]> {
    return this.callRepository.listHistoryByUserId(userId, limit);
  }

  async listActive(userId: string): Promise<CallSession[]> {
    return this.callRepository.listActiveByUserId(userId);
  }

  async expireUnansweredCalls(timeoutSeconds: number): Promise<CallSession[]> {
    const activeSessions = await this.callRepository.listAllActive();
    if (activeSessions.length === 0) {
      return [];
    }

    const now = Date.now();
    const expiredSessions: CallSession[] = [];

    for (const session of activeSessions) {
      const startedAtMs = new Date(session.started_at).getTime();
      if (!Number.isFinite(startedAtMs)) {
        continue;
      }

      const elapsedSeconds = Math.floor((now - startedAtMs) / 1000);
      if (elapsedSeconds < timeoutSeconds) {
        continue;
      }

      const hasNonInitiatorConnection = session.participants.some(
        (participant) =>
          participant.user_id !== session.initiator_id &&
          (participant.state === "connected" || participant.state === "left"),
      );

      if (hasNonInitiatorConnection) {
        continue;
      }

      try {
        const endedSession = await this.endCall(
          session.id,
          session.initiator_id,
          session.conversation_id,
          "no_answer_timeout",
          { failIfEnded: true },
        );
        expiredSessions.push(endedSession);
      } catch {
        // Ignore individual failures so one bad record does not block the sweep.
      }
    }

    return expiredSessions;
  }

  async autoEndDeclinedDirectCall(
    callId: string,
    conversationId: string,
  ): Promise<CallSession | null> {
    const session = await this.callRepository.getSessionById(callId);
    if (!session) {
      return null;
    }

    if (session.conversation_id !== conversationId) {
      return null;
    }

    if (session.status === "ended") {
      return session;
    }

    if (session.call_type !== "direct") {
      return session;
    }

    const hasDeclined = session.participants.some(
      (participant) => participant.state === "declined",
    );
    const hasConnected = session.participants.some(
      (participant) =>
        participant.state === "connected" || participant.state === "left",
    );

    if (!hasDeclined || hasConnected) {
      return session;
    }

    return this.endCall(
      callId,
      session.initiator_id,
      conversationId,
      "declined_by_peer",
    );
  }

  async issueLiveKitToken(input: {
    callId: string;
    conversationId: string;
    userId: string;
  }): Promise<{
    token: string;
    ws_url: string;
    room_name: string;
    expires_at: string;
  }> {
    if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      throw new HttpError(503, "livekit_not_configured");
    }

    const session = await this.callRepository.getSessionById(input.callId);
    if (!session) {
      throw new HttpError(404, "call_not_found");
    }

    if (session.conversation_id !== input.conversationId) {
      throw new HttpError(400, "conversation_mismatch");
    }

    if (session.status !== "active") {
      throw new HttpError(409, "call_not_active");
    }

    const isParticipant = session.participant_user_ids.includes(input.userId);
    if (!isParticipant) {
      throw new HttpError(403, "not_a_member");
    }

    const roomName = `call-${input.callId}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const token = jwt.sign(
      {
        video: {
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canSubscribe: true,
        },
        metadata: JSON.stringify({
          call_id: session.id,
          conversation_id: session.conversation_id,
          user_id: input.userId,
        }),
      },
      env.LIVEKIT_API_SECRET,
      {
        algorithm: "HS256",
        issuer: env.LIVEKIT_API_KEY,
        subject: input.userId,
        expiresIn: "1h",
      },
    );

    return {
      token,
      ws_url: env.LIVEKIT_PUBLIC_URL ?? env.LIVEKIT_URL,
      room_name: roomName,
      expires_at: expiresAt.toISOString(),
    };
  }

  private buildHistoryItems(session: CallSession): CallHistoryItem[] {
    return session.participants.map((participant) => {
      const status =
        participant.state === "connected" || participant.state === "left"
          ? "answered"
          : participant.state === "declined"
            ? "declined"
            : "missed";

      return {
        user_id: participant.user_id,
        created_at_call_id: `${session.started_at}#${session.id}`,
        call_id: session.id,
        conversation_id: session.conversation_id,
        call_type: session.call_type,
        initiator_id: session.initiator_id,
        status,
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration_seconds: session.duration_seconds,
        end_reason: session.end_reason,
        participant_user_ids: session.participant_user_ids,
      };
    });
  }
}
