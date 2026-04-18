import { env } from "../config/env.js";

export interface ClassifyResult {
  intent: string;
  confidence: number;
  action?: string;
}

const INTENT_PATTERNS: Record<
  string,
  { keywords: string[]; action?: string; confidence: number }
> = {
  HOW_TO_ADD_FRIEND: {
    keywords: [
      "thêm",
      "kết",
      "bạn",
      "add",
      "friend",
      "how",
      "để",
      "sao",
      "làm",
    ],
    confidence: 0.9,
  },
  PASSWORD_RESET: {
    keywords: ["quên", "mật", "khẩu", "reset", "password", "đổi"],
    confidence: 0.9,
  },
  HOW_TO_CREATE_GROUP: {
    keywords: ["tạo", "nhóm", "group", "chat", "create"],
    confidence: 0.85,
  },
  ACCOUNT_ISSUES: {
    keywords: ["khóa", "bị", "không", "vào", "được", "locked", "disabled"],
    confidence: 0.8,
  },
  GENERAL_HELP: {
    keywords: ["giúp", "hướng dẫn", "help", "guide", "tutorial"],
    confidence: 0.7,
  },
  CONTACT_SUPPORT: {
    keywords: ["liên", "hệ", "contact", "admin", "support", "báo", "cáo"],
    action: "escalate",
    confidence: 0.8,
  },
};

export class IntentClassifier {
  classify(message: string): ClassifyResult {
    const normalizedMessage = message.toLowerCase().trim();
    const words = normalizedMessage.split(/\s+/);

    let bestIntent = "GENERAL_INQUIRY";
    let bestConfidence = 0;
    let bestAction: string | undefined;

    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
      const matchCount = words.filter((word) =>
        pattern.keywords.some((kw) => word.includes(kw)),
      ).length;

      const confidence =
        (matchCount / pattern.keywords.length) * pattern.confidence;

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestIntent = intent;
        bestAction = pattern.action;
      }
    }

    // Ensure confidence is between 0 and 1
    bestConfidence = Math.min(Math.max(bestConfidence, 0), 1);

    return {
      intent: bestIntent,
      confidence: parseFloat(bestConfidence.toFixed(2)),
      action: bestAction,
    };
  }

  async classifyWithAI(message: string): Promise<ClassifyResult> {
    if (!env.ENABLE_AI_ENGINE) {
      return this.classify(message);
    }

    try {
      // TODO: Integrate with OpenAI API
      // This is a placeholder for future AI integration
      return this.classify(message);
    } catch {
      // Fallback to rule-based
      return this.classify(message);
    }
  }
}

export const intentClassifier = new IntentClassifier();
