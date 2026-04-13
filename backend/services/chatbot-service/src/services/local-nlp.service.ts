/**
 * Local NLP Service — Vietnamese Intent Classification
 * Offline, no external API calls needed.
 * Learns from user interactions via Redis (via LearningService).
 *
 * ─── HOW TO ADD MORE TRAINING DATA ──────────────────────────────────────────
 * 1. Add a new object to the `patterns` array below with:
 *    - intent:    unique UPPER_SNAKE_CASE name
 *    - keywords:  Vietnamese words WITHOUT diacritics (the transliterate()
 *                 function strips them automatically before matching)
 *    - response:  the reply shown to the user (WITH full Vietnamese diacritics)
 *    - action:    "escalate" if this should be forwarded to a human agent,
 *                 or undefined to let the bot handle it entirely.
 * 2. Restart the chatbot-service — no rebuild needed (TypeScript is compiled
 *    at startup via ts-node / the Dockerfile runs `tsc` first).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { learningService, type LearnedPattern } from "./learning.service.js";

export interface LocalNLPResponse {
  intent: string;
  confidence: number;
  suggestedResponse: string;
  action?: string;
}

interface IntentPattern {
  intent: string;
  keywords: string[];
  response: string;
  action?: string;
}

export class LocalNLPService {
  // ─── TRAINING DATA ─────────────────────────────────────────────────────────
  // Add / edit entries here to train the chatbot.
  // Keywords MUST be in ASCII (no diacritics) — transliterate() handles that.
  // ──────────────────────────────────────────────────────────────────────────
  private readonly patterns: IntentPattern[] = [
    // ── Authentication & account recovery ────────────────────────────────────
    {
      intent: "PASSWORD_RESET",
      keywords: [
        "forget",
        "forgot password",
        "reset",
        "password",
        "change password",
        "recover password",
        "cannot login",
        "login error",
        "lost password",
      ],
      response:
        'To reset your password:\n1. Click "Forgot Password?" on the login screen\n2. Enter your registered email address\n3. Check your inbox (including Spam)\n4. Click the link in the email and create a new password\n\nYour new password must be at least 8 characters long. Do you need further assistance?',
    },

    // ── Social: add/find friends ──────────────────────────────────────────────
    {
      intent: "HOW_TO_ADD_FRIEND",
      keywords: [
        "add friend",
        "make friends",
        "find friend",
        "invite",
        "search friend",
        "friend request",
        "accept request",
        "friends",
        "friend list",
        "unfriend",
        "remove friend",
      ],
      response:
        'To add friends on Zalo-Lite:\n1. Open the "Friends" tab\n2. Tap "Search" and enter a phone number\n3. Tap "Add Friend" to send an invitation\n4. Wait for them to accept in the "Requests" tab\n\nCan I help you with anything else?',
    },

    // ── Group chat ────────────────────────────────────────────────────────────
    {
      intent: "HOW_TO_CREATE_GROUP",
      keywords: [
        "create group",
        "group",
        "new group",
        "group chat",
        "team chat",
        "conversation",
        "cannot create group",
        "add member",
        "remove member",
        "leave group",
        "exit group",
      ],
      response:
        'To create a group chat:\n1. Go to the "Messages" tab → tap the "+" icon (top right)\n2. Enter a group name\n3. Select at least 2 friends\n4. Tap "Create Group"\n\nNote: You need at least 2 friends in your list. Let me know if you need help!',
    },

    // ── Account issues ───────────────────────────────────────────────────────
    {
      intent: "ACCOUNT_ISSUES",
      keywords: [
        "account",
        "locked",
        "blocked",
        "cannot access",
        "login",
        "register",
        "delete account",
        "activate account",
        "banned",
        "deactivated",
      ],
      response:
        "Account issues require manual review from our team.\n\nPlease provide:\n• Registered email or phone number\n• Detailed description of the issue\n• When the issue started occurring\n\nWe will review and respond within 24 hours.",
      action: "escalate",
    },

    // ── Contact & general support ─────────────────────────────────────────────
    {
      intent: "CONTACT_SUPPORT",
      keywords: [
        "contact",
        "support",
        "need help",
        "assist",
        "error",
        "report bug",
        "policy",
        "complain",
        "staff",
        "consult",
        "question",
        "help",
        "feedback",
      ],
      response:
        "Contact Zalo-Lite support:\n• Email: support@zalo-lite.com\n• Hotline: 1800-1234 (Mon-Sat, 8:00 AM–8:00 PM)\n• Live Chat: reply here and an agent will assist you soon.\n\nPlease provide specific details so we can help faster.",
      action: "escalate",
    },

    // ── Feature questions ─────────────────────────────────────────────────────
    {
      intent: "FEATURE_INQUIRY",
      keywords: [
        "feature",
        "how to",
        "way",
        "why",
        "cannot",
        "where",
        "guide",
        "use",
        "setting",
        "setup",
        "start",
        "tutorial",
      ],
      response:
        "Which Zalo-Lite feature do you need help with?\n\nKey features:\n✓ 1-on-1 and Group Chat (up to 3+ people)\n✓ Send photos, videos, and files\n✓ Add friends via phone number\n✓ Online/Offline status\n✓ End-to-end encryption\n\nPlease describe what you're trying to do!",
    },

    // ── Billing ───────────────────────────────────────────────────────────────
    {
      intent: "BILLING_ISSUES",
      keywords: [
        "payment",
        "cost",
        "finance",
        "invoice",
        "money",
        "price",
        "fee",
        "free",
        "premium",
        "upgrade",
        "plan",
        "charged",
        "refund",
      ],
      response:
        "Zalo-Lite Billing Info:\n\nZalo-Lite is completely FREE!\n✓ No account maintenance fees\n✓ Unlimited messaging\n✓ No forced advertisements\n\nIf you were inexplicably charged, please contact us immediately for an investigation.",
      action: "escalate",
    },

    // ── Privacy & security ───────────────────────────────────────────────────
    {
      intent: "PRIVACY_SECURITY",
      keywords: [
        "security",
        "privacy",
        "safe",
        "hacked",
        "compromised",
        "change phone number",
        "2fa",
        "otp",
        "spam",
        "block",
        "report spam",
      ],
      response:
        "Privacy & Security on Zalo-Lite:\n✓ End-to-end encryption for all messages\n✓ We do not share your personal data\n✓ Block users: Go to their profile → Block\n✓ Report spam: Long press a message → Report\n\nIf you suspect an account breach, change your password immediately and contact support.",
    },

    // ── App crash / not opening ───────────────────────────────────────────────
    {
      intent: "APP_CRASH",
      keywords: [
        "app crash",
        "crashing",
        "not opening",
        "stuck",
        "frozen",
        "force close",
        "restart",
        "update",
        "white screen",
        "black screen",
        "loading issue",
      ],
      response:
        "App Troubleshooting:\n1. Force close the app and reopen it\n2. Check your internet connection\n3. Clear the app cache (Settings → Apps → Zalo-Lite → Clear Cache)\n4. Update to the latest version via App Store/Google Play\n5. Restart your device\n\nStill experiencing issues? Please tell us your OS model.",
    },

    // ── Notifications ─────────────────────────────────────────────────────────
    {
      intent: "NOTIFICATION_ISSUES",
      keywords: [
        "notification",
        "no notification",
        "push",
        "sound",
        "vibrate",
        "alerts",
        "silent",
        "not ringing",
        "dnd",
        "do not disturb",
      ],
      response:
        'Notification Settings:\n1. System: Settings → Notifications → Zalo-Lite → Turn on\n2. In-App: Settings → Notifications → Enable sound and vibration\n3. Check if "Do Not Disturb" mode is active on your phone\n4. Ensure a stable internet connection\n\nAre you using iOS or Android?',
    },

    // ── Media sharing ─────────────────────────────────────────────────────────
    {
      intent: "MEDIA_SHARING",
      keywords: [
        "send photo",
        "send video",
        "send file",
        "attachment",
        "picture",
        "image",
        "upload",
        "cannot send",
        "not showing",
        "save file",
        "download",
      ],
      response:
        "Media & Files:\n• Open a chat → tap the attachment icon (📎)\n• Choose an image from your gallery or snap a new one\n• Max sizes: Image 10MB, Video 50MB, File 100MB\n\nIf it fails:\n1. Check your network\n2. Check file size limits\n3. Grant Storage permissions in device settings",
    },

    // ── Voice / video call ────────────────────────────────────────────────────
    {
      intent: "VOICE_VIDEO_CALL",
      keywords: [
        "call",
        "video call",
        "voice call",
        "cannot hear",
        "cannot see",
        "call error",
        "microphone",
        "mic",
        "camera",
        "disconnected",
      ],
      response:
        "Voice & Video calls:\n• Open chat → tap the phone (voice) or camera (video) icon\n\nTroubleshooting:\n1. Allow Microphone & Camera permissions\n2. Maintain at least a 1Mbps connection\n3. Verify the other user is online\n4. Toggle wifi to refresh network\n\nDoes the issue persist? Detail the error to get assistance.",
    },
  ];

  private transliterate(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ─── CLASSIFY ──────────────────────────────────────────────────────────────

  async classifyAndRespond(
    userMessage: string,
  ): Promise<LocalNLPResponse & { isLearned: boolean }> {
    const normalizedMsg = this.transliterate(userMessage);
    const learnedPatterns = await learningService.getAllLearnedPatterns();

    let bestMatch: IntentPattern | null = null;
    let bestMatchCount = 0;
    let isLearned = false;

    for (const pattern of this.patterns) {
      let matchCount = 0;

      // Check built-in keywords
      for (const keyword of pattern.keywords) {
        if (normalizedMsg.includes(keyword)) matchCount++;
      }

      // Augment with dynamically learned keywords
      const learnedPattern = learnedPatterns.find(
        (p) => p.intent === pattern.intent,
      );
      if (learnedPattern) {
        for (const kw of learnedPattern.keywords ?? []) {
          if (normalizedMsg.includes(kw)) {
            matchCount++;
            isLearned = true;
          }
        }
      }

      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        bestMatch = pattern;
      }
    }

    // No match — return general fallback
    if (bestMatchCount === 0 || !bestMatch) {
      return {
        intent: "GENERAL_INQUIRY",
        confidence: 0.3,
        suggestedResponse:
          "I'm sorry, I couldn't fully understand your request. Could you provide more details?\n\nAlternatively, select a common topic:\n• Password Recovery\n• Add Friends\n• Create Group Chat\n• Account Issues\n• Contact Support Staff",
        action: undefined,
        isLearned: false,
      };
    }

    // Confidence = (matched / total_in_pattern) scaled by message length
    const patternCoverage = bestMatchCount / bestMatch.keywords.length;
    const lengthFactor = Math.min(normalizedMsg.length / 40, 1.0);
    const learnBoost = isLearned ? 1.1 : 1.0;
    const confidence = Math.min(
      patternCoverage * (0.5 + lengthFactor * 0.5) * learnBoost,
      0.99,
    );

    const result = {
      intent: bestMatch.intent,
      confidence,
      suggestedResponse: bestMatch.response,
      action: bestMatch.action,
      isLearned,
    };

    // Learn from high-confidence classifications in the background
    if (confidence > 0.6) {
      learningService
        .learnFromSuccess(
          userMessage,
          result.intent,
          confidence,
          result.suggestedResponse,
        )
        .catch((err) => console.error("[NLP Learning error]", err));
    }

    return result;
  }
}

export const localNLPService = new LocalNLPService();
