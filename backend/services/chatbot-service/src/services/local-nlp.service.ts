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
        "quen mat khau",
        "quen pass",
        "doi mat khau",
        "lay lai mat khau",
        "khong dang nhap duoc",
        "loi dang nhap",
        "mat mat khau",
        "reset pass",
        "mat khau",
      ],
      response:
        'Để đặt lại mật khẩu của bạn:\n1. Bấm vào "Quên mật khẩu?" ở màn hình đăng nhập\n2. Nhập số điện thoại hoặc email đã đăng ký\n3. Kiểm tra tin nhắn SMS hoặc hộp thư đến (kể cả thư rác)\n4. Nhập mã OTP và tạo mật khẩu mới\n\nMật khẩu mới phải có ít nhất 8 ký tự. Bạn có cần hỗ trợ thêm không?',
    },

    // ── Social: add/find friends ──────────────────────────────────────────────
    {
      intent: "HOW_TO_ADD_FRIEND",
      keywords: [
        "ket ban",
        "them ban",
        "tim ban",
        "loi moi ket ban",
        "chap nhan ket ban",
        "danh sach ban be",
        "xoa ban",
        "huy ket ban",
        "add friend",
      ],
      response:
        'Để kết bạn trên Zalo-Lite:\n1. Mở tab "Danh bạ"\n2. Bấm vào biểu tượng Thêm bạn (hoặc Tìm kiếm) và nhập số điện thoại\n3. Bấm "Kết bạn" để gửi lời mời\n4. Chờ người đó chấp nhận\n\nTôi có thể giúp gì thêm cho bạn?',
    },

    // ── Group chat ────────────────────────────────────────────────────────────
    {
      intent: "HOW_TO_CREATE_GROUP",
      keywords: [
        "tao nhom",
        "lap nhom",
        "nhom chat",
        "chat nhom",
        "loi tao nhom",
        "them thanh vien",
        "xoa thanh vien",
        "roi nhom",
        "thoat nhom",
        "group",
      ],
      response:
        'Để tạo nhóm chat:\n1. Vào tab "Tin nhắn" → bấm biểu tượng "+" ở góc phải\n2. Đặt tên nhóm\n3. Chọn ít nhất 2 người bạn\n4. Bấm "Tạo nhóm"\n\nLưu ý: Bạn cần có ít nhất 2 bạn bè trong danh bạ để tạo nhóm.',
    },

    // ── Account issues ───────────────────────────────────────────────────────
    {
      intent: "ACCOUNT_ISSUES",
      keywords: [
        "tai khoan",
        "bi khoa",
        "bi chan",
        "khong vao duoc",
        "dang nhap",
        "dang ky",
        "xoa tai khoan",
        "kich hoat",
        "vo hieu hoa",
      ],
      response:
        "Vấn đề về tài khoản cần được đội ngũ của chúng tôi kiểm tra thủ công.\n\nVui lòng cung cấp:\n• Số điện thoại hoặc email đăng ký\n• Mô tả chi tiết vấn đề bạn đang gặp phải\n• Thời điểm bắt đầu xảy ra lỗi\n\nChúng tôi sẽ kiểm tra và phản hồi trong vòng 24 giờ.",
      action: "escalate",
    },

    // ── Contact & general support ─────────────────────────────────────────────
    {
      intent: "CONTACT_SUPPORT",
      keywords: [
        "lien he",
        "ho tro",
        "can giup",
        "tro giup",
        "loi",
        "bao loi",
        "khieu nai",
        "nhan vien",
        "tu van",
        "cau hoi",
        "gop y",
      ],
      response:
        "Liên hệ hỗ trợ Zalo-Lite:\n• Email: support@zalo-lite.com\n• Hotline: 1800-1234 (Thứ 2 - Thứ 7, 8:00 - 20:00)\n• Chat trực tiếp: Bạn có thể nhắn chi tiết tại đây, nhân viên sẽ hỗ trợ bạn sớm nhất.\n\nVui lòng cung cấp chi tiết vấn đề để chúng tôi xử lý nhanh hơn.",
      action: "escalate",
    },

    // ── Feature questions ─────────────────────────────────────────────────────
    {
      intent: "FEATURE_INQUIRY",
      keywords: [
        "tinh nang",
        "cach lam",
        "cach nao",
        "tai sao",
        "khong the",
        "o dau",
        "huong dan",
        "su dung",
        "cai dat",
        "bat dau",
      ],
      response:
        "Bạn cần hỗ trợ về tính năng nào của Zalo-Lite?\n\nCác tính năng chính:\n✓ Chat 1-1 và Nhóm\n✓ Gửi ảnh, video và tệp tin\n✓ Kết bạn qua số điện thoại\n✓ Mã hóa đầu cuối an toàn\n\nVui lòng mô tả rõ hơn điều bạn muốn làm nhé!",
    },

    // ── Billing ───────────────────────────────────────────────────────────────
    {
      intent: "BILLING_ISSUES",
      keywords: [
        "thanh toan",
        "phi",
        "tien",
        "hoa don",
        "gia tien",
        "mien phi",
        "nang cap",
        "bi tru tien",
        "hoan tien",
      ],
      response:
        "Thông tin cước phí Zalo-Lite:\n\nZalo-Lite hoàn toàn MIỄN PHÍ!\n✓ Không phí duy trì tài khoản\n✓ Nhắn tin, gọi điện không giới hạn\n✓ Không quảng cáo\n\nNếu bạn bị trừ tiền hoặc yêu cầu trả phí, đó có thể là lừa đảo. Vui lòng báo cáo lại cho chúng tôi.",
      action: "escalate",
    },

    // ── Privacy & security ───────────────────────────────────────────────────
    {
      intent: "PRIVACY_SECURITY",
      keywords: [
        "bao mat",
        "an toan",
        "bi hack",
        "mat tai khoan",
        "doi so dien thoai",
        "ma otp",
        "quyen rieng tu",
        "spam",
        "chan",
        "bao xau",
      ],
      response:
        "Bảo mật trên Zalo-Lite:\n✓ Tin nhắn được mã hóa đầu cuối\n✓ Chặn người dùng: Vào trang cá nhân của họ → Chọn Chặn\n✓ Báo xấu: Nhấn giữ tin nhắn → Chọn Báo cáo\n\nNếu nghi ngờ tài khoản bị xâm nhập, hãy đổi mật khẩu ngay và liên hệ bộ phận hỗ trợ.",
    },

    // ── App crash / not opening ───────────────────────────────────────────────
    {
      intent: "APP_CRASH",
      keywords: [
        "văng app",
        "vang app",
        "dung ung dung",
        "khong mo duoc",
        "bi do",
        "treo may",
        "khoi dong lai",
        "man hinh trang",
        "man hinh den",
        "loi ung dung",
      ],
      response:
        "Khắc phục sự cố ứng dụng:\n1. Đóng hẳn ứng dụng và mở lại\n2. Kiểm tra kết nối mạng\n3. Xóa bộ nhớ đệm (Cài đặt máy → Ứng dụng → Zalo-Lite → Xóa Cache)\n4. Cập nhật phiên bản mới nhất\n5. Khởi động lại thiết bị\n\nNếu vẫn bị lỗi, vui lòng cho chúng tôi biết bạn đang dùng điện thoại gì nhé.",
    },

    // ── Notifications ─────────────────────────────────────────────────────────
    {
      intent: "NOTIFICATION_ISSUES",
      keywords: [
        "thong bao",
        "khong co thong bao",
        "am thanh",
        "rung",
        "im lang",
        "khong do chuong",
        "khong keu",
        "lam phien",
      ],
      response:
        'Cài đặt thông báo:\n1. Hệ thống: Cài đặt máy → Thông báo → Zalo-Lite → Bật\n2. Trong App: Cài đặt → Thông báo → Bật âm thanh và rung\n3. Đảm bảo máy không bật chế độ "Không làm phiền" (Do Not Disturb)\n4. Kiểm tra mạng\n\nBạn đang dùng iOS hay Android?',
    },

    // ── Media sharing ─────────────────────────────────────────────────────────
    {
      intent: "MEDIA_SHARING",
      keywords: [
        "gui anh",
        "gui video",
        "gui file",
        "dinh kem",
        "hinh anh",
        "khong gui duoc",
        "loi hinh",
        "luu file",
        "tai xuong",
      ],
      response:
        "Chia sẻ File & Media:\n• Mở khung chat → bấm biểu tượng đính kèm (📎)\n• Chọn ảnh từ thư viện hoặc chụp mới\n• Giới hạn kích thước: Ảnh 10MB, Video 50MB, File 100MB\n\nNếu bị lỗi:\n1. Kiểm tra mạng internet\n2. Đảm bảo file không quá dung lượng\n3. Cấp quyền truy cập Bộ nhớ cho ứng dụng",
    },

    // ── Voice / video call ────────────────────────────────────────────────────
    {
      intent: "VOICE_VIDEO_CALL",
      keywords: [
        "goi dien",
        "goi video",
        "call",
        "khong nghe duoc",
        "khong thay hinh",
        "loi cuoc goi",
        "micro",
        "mic",
        "camera",
        "mat ket noi",
      ],
      response:
        "Gọi thoại & Gọi Video:\n• Mở khung chat → bấm biểu tượng điện thoại (gọi thoại) hoặc máy quay (gọi video)\n\nKhắc phục lỗi:\n1. Cấp quyền Micro và Camera cho ứng dụng\n2. Đảm bảo mạng wifi/4G ổn định\n3. Thử tắt bật lại wifi\n\nLỗi vẫn tiếp diễn? Vui lòng mô tả chi tiết để nhân viên hỗ trợ bạn.",
    },
  ];

  private transliterate(text: string): string {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
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
          "Xin lỗi, tôi chưa hiểu rõ vấn đề của bạn. Bạn có thể cung cấp thêm chi tiết không?\n\nHoặc chọn một trong các chủ đề phổ biến:\n• Khôi phục mật khẩu\n• Kết bạn mới\n• Tạo nhóm chat\n• Lỗi tài khoản\n• Gặp nhân viên hỗ trợ",
        action: undefined,
        isLearned: false,
      };
    }

    let confidence;
    const hasExactKeywordMatch = bestMatchCount > 0;

    // TRƯỜNG HỢP 1: Khớp từ khóa tuyệt đối (Short-circuit) mang lại độ tin cậy cao lập tức
    if (hasExactKeywordMatch) {
      confidence = isLearned ? 0.98 : 0.95;
    } 
    // TRƯỜNG HỢP 2: Tính toán dựa trên độ phủ và độ dài câu
    else {
      const patternCoverage = bestMatchCount / bestMatch.keywords.length;
      const lengthFactor = Math.min(normalizedMsg.length / 40, 1.0);
      const learnBoost = isLearned ? 1.1 : 1.0;

      confidence = patternCoverage * (0.5 + lengthFactor * 0.5) * learnBoost;
      
      // Giới hạn trần tối đa để không vượt quá 0.99
      confidence = Math.min(confidence, 0.99);
    }

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
