/**
 * Local NLP Service - Vietnamese Intent Classification
 * No API calls needed, 100% offline
 * Self-learning from user interactions
 */

import { learningService, LearnedPattern } from "./learning.service.js";

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
  private patterns: IntentPattern[] = [
    {
      intent: "PASSWORD_RESET",
      keywords: [
        "quen",
        "mat khau",
        "reset",
        "password",
        "cap lai",
        "dang nhap khong",
        "khong nho",
      ],
      response:
        "🔐 Để đặt lại mật khẩu:\n1. Nhấp 'Quên mật khẩu?' trên màn hình đăng nhập\n2. Nhập email của bạn\n3. Kiểm tra hộp thư để nhận liên kết đặt lại\n4. Tạo mật khẩu mới\n\nCần giúp thêm không?",
      action: undefined,
    },
    {
      intent: "HOW_TO_ADD_FRIEND",
      keywords: [
        "them ban",
        "ket ban",
        "tim ban",
        "moi ban",
        "add",
        "tim kiem",
        "lien he",
      ],
      response:
        "👥 Thêm bạn bè dễ dàng:\n1. Mở tab 'Liên hệ'\n2. Nhấp biểu tượng '+'\n3. Tìm kiếm theo tên hoặc số điện thoại\n4. Nhấp 'Gửi lời mời kết bạn'\n5. Chờ họ chấp nhận\n\nBạn cần giúp gì khác?",
      action: undefined,
    },
    {
      intent: "HOW_TO_CREATE_GROUP",
      keywords: [
        "tao nhom",
        "nhom",
        "group",
        "tao group",
        "tao nhom chat",
        "nhom ban",
      ],
      response:
        "👨‍👩‍👧‍👦 Tạo nhóm chat:\n1. Nhấn biểu tượng '+' → 'Tạo nhóm'\n2. Chọn bạn bè (tối thiểu 2 người)\n3. Đặt tên nhóm\n4. Chọn ảnh (tùy chọn)\n5. Nhấp 'Tạo'\n\nHoàn tất! Bắt đầu chat với nhóm ngay.",
      action: undefined,
    },
    {
      intent: "ACCOUNT_ISSUES",
      keywords: [
        "tai khoan",
        "dang nhap",
        "dang ky",
        "xoa",
        "khoa",
        "bi khoa",
        "tai khoan bi",
        "khong the dang nhap",
      ],
      response:
        "⚠️ Vấn đề tài khoản yêu cầu hỗ trợ chuyên nghiệp.\n\nVui lòng cung cấp:\n• Email/điện thoại tài khoản\n• Mô tả chi tiết vấn đề\n• Thời gian xảy ra\n\nChúng tôi sẽ giải quyết trong 24 giờ.",
      action: "escalate",
    },
    {
      intent: "CONTACT_SUPPORT",
      keywords: [
        "lien he",
        "ho tro",
        "can giup",
        "support",
        "gap loi",
        "bao cao",
        "chinh sach",
        "khieu nai",
      ],
      response:
        "📞 Liên hệ hỗ trợ:\n• Email: support@zalo-lite.com\n• Hotline: 1800-1234\n• Chat trực tiếp: Nhấp nút 'Hỗ trợ' dưới đây\n\nThời gian hỗ trợ: Thứ 2-7, 8AM-8PM\n\nChúng tôi luôn sẵn sàng!",
      action: "escalate",
    },
    {
      intent: "FEATURE_INQUIRY",
      keywords: [
        "tinh nang",
        "lam sao",
        "cach",
        "the nao",
        "sao khong",
        "tai sao",
        "co tinh nang",
        "khong co",
      ],
      response:
        "❓ Bạn muốn biết về tính năng nào của Zalo-Lite?\n\nCác tính năng phổ biến:\n✓ Chat 1-1 & nhóm\n✓ Gọi điện & video call\n✓ Chia sẻ file/ảnh\n✓ Trạng thái online\n✓ Mã hóa end-to-end\n\nMô tả chi tiết tính năng bạn cần?",
      action: undefined,
    },
    {
      intent: "BILLING_ISSUES",
      keywords: [
        "thanh toan",
        "chi phi",
        "tai chi",
        "hoa don",
        "tien",
        "gia tien",
        "free",
      ],
      response:
        "💳 Thông tin thanh toán:\n\nZalo-Lite là ứng dụng hoàn toàn MIỄN PHÍ!\n\n✓ Không phí duy trì tài khoản\n✓ Không phí gọi/chat\n✓ Không quảng cáo bắt buộc\n\nNếu bị tính phí, vui lòng báo cáo ngay.",
      action: "escalate",
    },
    {
      intent: "PRIVACY_SECURITY",
      keywords: [
        "bao mat",
        "rieng tu",
        "an toan",
        "ma hoa",
        "tieu du ai",
        "toc do",
        "spam",
      ],
      response:
        "🔒 Bảo mật & Riêng tư:\n\n✓ Mã hóa end-to-end cho mọi tin nhắn\n✓ Dữ liệu lưu trữ an toàn tại Việt Nam\n✓ Không bao giờ chia sẻ thông tin cá nhân\n✓ Chặn người dùng & báo cáo spam dễ dàng\n\nBạn có tin tưởng chúng tôi không?",
      action: undefined,
    },
  ];

  /**
   * Simple transliteration (remove Vietnamese marks quickly)
   * Also handles corrupted UTF-8 from client-side encoding issues
   */
  private transliterate(text: string): string {
    return (
      text
        .toLowerCase()
        .trim()
        // Handle corrupted Vietnamese characters (from UTF-8 issues)
        // Pattern: [non-word-char|?] = corrupted diacritic
        .replace(/qu[^\w\s]?n/gi, "quen") // quên
        .replace(/m[^\w\s]?t/gi, "mat") // mật
        .replace(/kh[^\w\s]?u/gi, "khu") // khẩu → khu (then matches "khu" keyword indirectly)
        .replace(/th[^\w\s]?m/gi, "them") // thêm
        .replace(/b[^\w\s]?n/gi, "ban") // bạn
        .replace(/t[^\w\s]?o/gi, "tao") // tạo
        .replace(/nh[^\w\s]?m/gi, "nhom") // nhóm
        .replace(/t[^\w\s]?i\s+kho[^\w\s]?n/gi, "tai khoan") // tài khoản
        .replace(/[^\w\s]/g, "") // Remove remaining special chars
        // Map clean Vietnamese diacritics to ASCII equivalents
        .replace(/[àáảãạăằắẳẵặâầấẩẫậ]/g, "a")
        .replace(/[èéẻẽẹêềếểễệ]/g, "e")
        .replace(/[ìíỉĩị]/g, "i")
        .replace(/[òóỏõọôồốổỗộơờớởỡợ]/g, "o")
        .replace(/[ùúủũụưừứửữự]/g, "u")
        .replace(/[ỳýỷỹỵ]/g, "y")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s]/g, "")
    ); // Remove any remaining special chars
  }

  /**
   * Classify user intent based on Vietnamese keywords + learned patterns
   */
  async classifyAndRespond(
    userMessage: string,
  ): Promise<LocalNLPResponse & { isLearned: boolean }> {
    const normalizedMsg = this.transliterate(userMessage);

    let bestMatch: IntentPattern | null = null;
    let bestMatchCount = 0;
    let totalKeywords = 0;
    let isLearned = false;

    // Get all learned patterns to expand matching
    const learnedPatterns = await learningService.getAllLearnedPatterns();

    // Find pattern with most keyword matches
    for (const pattern of this.patterns) {
      let matchCount = 0;
      totalKeywords += pattern.keywords.length;

      // Check hardcoded keywords
      for (const keyword of pattern.keywords) {
        if (normalizedMsg.includes(keyword)) {
          matchCount++;
        }
      }

      // Also check learned keywords for this intent
      const learnedPattern = learnedPatterns.find(
        (p) => p.intent === pattern.intent,
      );
      if (learnedPattern) {
        for (const learnedKeyword of learnedPattern.keywords || []) {
          if (normalizedMsg.includes(learnedKeyword)) {
            matchCount++;
            isLearned = true;
          }
        }
      }

      // Keep track of best matching pattern
      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        bestMatch = pattern;
      }
    }

    // If no keywords matched, return general inquiry
    if (bestMatchCount === 0) {
      return {
        intent: "GENERAL_INQUIRY",
        confidence: 0.4,
        suggestedResponse:
          "Xin lỗi, tôi chưa hiểu rõ câu hỏi của bạn. Vui lòng mô tả chi tiết hơn để tôi giúp bạn tốt hơn. 😊",
        action: undefined,
        isLearned: false,
      };
    }

    // Improved confidence calculation
    // Formula: (matches / total_in_pattern) * (message_length_factor) * boost_factor
    const patternCoverage =
      (bestMatchCount / (bestMatch?.keywords.length || 1)) * 0.95;
    const lengthFactor = Math.min(normalizedMsg.length / 50, 1.0);
    const learnBoost = isLearned ? 1.1 : 1.0; // 10% boost if using learned keywords
    const baseConfidence = Math.min(
      patternCoverage * (0.5 + lengthFactor) * learnBoost,
      0.99,
    );

    const result = {
      intent: bestMatch?.intent || "GENERAL_INQUIRY",
      confidence: baseConfidence,
      suggestedResponse: bestMatch?.response || "Cảm ơn bạn đã liên hệ.",
      action: bestMatch?.action,
      isLearned,
    };

    // Learn from successful classification in background (don't await)
    if (baseConfidence > 0.6) {
      learningService
        .learnFromSuccess(
          userMessage,
          result.intent,
          baseConfidence,
          result.suggestedResponse,
        )
        .catch((err) => console.error("Learning error:", err));
    }

    return result;
  }
}

export const localNLPService = new LocalNLPService();
