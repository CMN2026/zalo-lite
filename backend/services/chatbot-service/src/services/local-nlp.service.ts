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
        "quen",
        "mat khau",
        "reset",
        "password",
        "cap lai",
        "doi mat khau",
        "khong nho mat khau",
        "lay lai mat khau",
        "phuc hoi mat khau",
        "quen mk",
        "mk",
        "dang nhap khong duoc",
        "loi mat khau",
      ],
      response:
        "🔐 Để đặt lại mật khẩu:\n1. Nhấn \"Quên mật khẩu?\" trên màn hình đăng nhập\n2. Nhập email đã đăng ký\n3. Kiểm tra hộp thư đến (kể cả Spam)\n4. Nhấn liên kết trong email và tạo mật khẩu mới\n\nMật khẩu mới phải dài ít nhất 8 ký tự. Bạn cần hỗ trợ thêm không?",
    },

    // ── Social: add/find friends ──────────────────────────────────────────────
    {
      intent: "HOW_TO_ADD_FRIEND",
      keywords: [
        "them ban",
        "ket ban",
        "tim ban",
        "moi ban",
        "add friend",
        "tim kiem ban",
        "loi moi",
        "gui loi moi",
        "chap nhan loi moi",
        "ban be",
        "danh sach ban",
        "xoa ban",
        "huy ket ban",
      ],
      response:
        "👥 Thêm bạn bè trên Zalo-Lite:\n1. Mở tab \"Bạn bè\" (biểu tượng người dùng)\n2. Nhấn tab \"Tìm\" rồi nhập số điện thoại\n3. Nhấn \"Add Friend\" để gửi lời mời\n4. Chờ họ chấp nhận trong tab \"Requests\"\n\nBạn cần giúp gì thêm không?",
    },

    // ── Group chat ────────────────────────────────────────────────────────────
    {
      intent: "HOW_TO_CREATE_GROUP",
      keywords: [
        "tao nhom",
        "nhom",
        "group",
        "tao group",
        "tao nhom chat",
        "nhom ban",
        "chat nhom",
        "cuoc tro chuyen nhom",
        "cuoc tro chuyen",
        "tạo cuộc trò chuyện",
        "khong the tao nhom",
        "loi tao nhom",
        "them thanh vien",
        "xoa thanh vien",
        "roi nhom",
        "ra khoi nhom",
      ],
      response:
        "👥 Tạo nhóm chat:\n1. Vào tab \"Tin nhắn\" → nhấn nút \"+\" (góc trên phải)\n2. Nhập tên nhóm\n3. Chọn ít nhất 2 bạn bè từ danh sách\n4. Nhấn \"Tạo nhóm\"\n\nLưu ý: Bạn cần có ít nhất 2 bạn bè trong hệ thống để tạo nhóm. Cần giúp gì thêm không?",
    },

    // ── Account issues ───────────────────────────────────────────────────────
    {
      intent: "ACCOUNT_ISSUES",
      keywords: [
        "tai khoan",
        "khoa tai khoan",
        "bi khoa",
        "khong the dang nhap",
        "dang nhap",
        "dang ky",
        "xoa tai khoan",
        "kich hoat tai khoan",
        "bi chan",
        "khong truy cap duoc",
        "account",
        "tai khoan bi chan",
        "bi vo hieu hoa",
      ],
      response:
        "⚠️ Vấn đề tài khoản cần xử lý thủ công.\n\nVui lòng cung cấp:\n• Email hoặc SĐT đăng ký tài khoản\n• Mô tả chi tiết vấn đề đang gặp\n• Thời gian phát hiện vấn đề\n\nChúng tôi sẽ xem xét và phản hồi trong vòng 24 giờ.",
      action: "escalate",
    },

    // ── Contact & general support ─────────────────────────────────────────────
    {
      intent: "CONTACT_SUPPORT",
      keywords: [
        "lien he",
        "ho tro",
        "can giup",
        "support",
        "gap loi",
        "bao cao loi",
        "chinh sach",
        "khieu nai",
        "phan anh",
        "nhan vien",
        "tu van",
        "dat cau hoi",
        "giup do",
        "lam phien",
        "phan hoi",
      ],
      response:
        "📞 Liên hệ hỗ trợ Zalo-Lite:\n• Email: support@zalo-lite.com\n• Hotline: 1800-1234 (Thứ 2–7, 8:00–20:00)\n• Chat trực tiếp: nhắn tin tại đây, nhân viên sẽ hỗ trợ bạn\n\nBạn có thể mô tả chi tiết vấn đề để chúng tôi hỗ trợ nhanh hơn.",
      action: "escalate",
    },

    // ── Feature questions ─────────────────────────────────────────────────────
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
        "huong dan",
        "su dung",
        "cai dat",
        "thiet lap",
        "cach su dung",
        "bat dau",
        "dung nhu the nao",
      ],
      response:
        "❓ Bạn cần hướng dẫn về tính năng nào của Zalo-Lite?\n\nCác tính năng chính:\n✓ Chat 1-1 và nhóm (tối thiểu 3 người)\n✓ Gửi ảnh, video, file đính kèm\n✓ Thêm bạn bè qua số điện thoại\n✓ Trạng thái online/offline\n✓ Bảo mật end-to-end\n\nHãy mô tả cụ thể tình huống bạn đang gặp để tôi hướng dẫn chi tiết hơn!",
    },

    // ── Billing ───────────────────────────────────────────────────────────────
    {
      intent: "BILLING_ISSUES",
      keywords: [
        "thanh toan",
        "chi phi",
        "tai chinh",
        "hoa don",
        "tien",
        "gia",
        "phi",
        "mien phi",
        "free",
        "premium",
        "nang cap",
        "goi cuoc",
        "bi tinh phi",
        "hoan tien",
      ],
      response:
        "💳 Thông tin thanh toán Zalo-Lite:\n\nZalo-Lite là ứng dụng MIỄN PHÍ hoàn toàn!\n✓ Không phí duy trì tài khoản\n✓ Không giới hạn tin nhắn\n✓ Không quảng cáo bắt buộc\n\nNếu bạn bị tính phí không rõ lý do, vui lòng liên hệ ngay để chúng tôi kiểm tra.",
      action: "escalate",
    },

    // ── Privacy & security ───────────────────────────────────────────────────
    {
      intent: "PRIVACY_SECURITY",
      keywords: [
        "bao mat",
        "rieng tu",
        "an toan",
        "ma hoa",
        "bi hack",
        "tai khoan bi xam nhap",
        "doi so dien thoai",
        "xac thuc 2 yeu to",
        "2fa",
        "otp",
        "spam",
        "chặn",
        "chan nguoi dung",
        "bao cao spam",
        "quyen rieng tu",
      ],
      response:
        "🔒 Bảo mật & Riêng tư trên Zalo-Lite:\n✓ Mã hóa end-to-end cho mọi tin nhắn\n✓ Không chia sẻ dữ liệu cá nhân\n✓ Chặn người dùng: vào profile → Chặn\n✓ Báo cáo spam: nhấn giữ tin nhắn → Báo cáo\n\nNếu nghi ngờ tài khoản bị xâm nhập, hãy đổi mật khẩu ngay và liên hệ hỗ trợ.",
    },

    // ── App crash / not opening ───────────────────────────────────────────────
    {
      intent: "APP_CRASH",
      keywords: [
        "ung dung",
        "app bi crash",
        "khong mo duoc",
        "bi treo",
        "thoat dot ngot",
        "loi ung dung",
        "force close",
        "khong chay duoc",
        "khoi dong lai",
        "update",
        "cap nhat",
        "phien ban moi",
        "loi khi mo",
        "khong load duoc",
        "man hinh trang",
      ],
      response:
        "🔧 Xử lý sự cố ứng dụng:\n1. Đóng hoàn toàn ứng dụng và mở lại\n2. Kiểm tra kết nối internet\n3. Xóa cache ứng dụng (Cài đặt → Ứng dụng → Zalo-Lite → Xóa cache)\n4. Cập nhật lên phiên bản mới nhất\n5. Khởi động lại thiết bị\n\nNếu vẫn còn lỗi, vui lòng mô tả thiết bị và hệ điều hành để hỗ trợ tốt hơn.",
    },

    // ── Notifications ─────────────────────────────────────────────────────────
    {
      intent: "NOTIFICATION_ISSUES",
      keywords: [
        "thong bao",
        "khong nhan duoc thong bao",
        "push notification",
        "notification",
        "am thanh",
        "rung",
        "cai dat thong bao",
        "bat thong bao",
        "tat thong bao",
        "thong bao khong hien",
        "khong bao",
        "im lang",
        "do khong phai phien",
      ],
      response:
        "🔔 Cài đặt thông báo:\n1. Vào Cài đặt hệ thống → Thông báo → Zalo-Lite → Bật thông báo\n2. Trong ứng dụng: Cài đặt → Thông báo → Bật âm thanh & rung\n3. Kiểm tra xem điện thoại có ở chế độ \"Không làm phiền\" không\n4. Kết nối internet ổn định là điều kiện nhận thông báo\n\nBạn đang dùng iOS hay Android?",
    },

    // ── Media sharing ─────────────────────────────────────────────────────────
    {
      intent: "MEDIA_SHARING",
      keywords: [
        "gui anh",
        "gui video",
        "gui file",
        "dinh kem",
        "anh",
        "video",
        "file",
        "hinh anh",
        "tai len",
        "upload",
        "khong gui duoc anh",
        "anh khong hien",
        "video khong phat",
        "chia se",
        "luu anh",
      ],
      response:
        "📎 Gửi ảnh, video và file:\n• Trong cửa sổ chat → nhấn biểu tượng đính kèm (📎)\n• Chọn ảnh từ thư viện hoặc chụp mới\n• Kích thước tối đa: ảnh 10MB, video 50MB, file 100MB\n\nNếu không gửi được:\n1. Kiểm tra kết nối internet\n2. Kiểm tra dung lượng file\n3. Cho phép ứng dụng truy cập bộ nhớ trong Cài đặt",
    },

    // ── Voice / video call ────────────────────────────────────────────────────
    {
      intent: "VOICE_VIDEO_CALL",
      keywords: [
        "goi dien",
        "video call",
        "cuoc goi",
        "goi thoai",
        "goi video",
        "khong nghe duoc",
        "khong nhin thay",
        "loi cuoc goi",
        "ket noi cuoc goi",
        "mic",
        "microphone",
        "camera",
        "cuoc goi bi ngat",
        "truoc cuoc goi",
      ],
      response:
        "📞 Gọi điện & Video call:\n• Mở chat → nhấn biểu tượng điện thoại (thoại) hoặc camera (video)\n\nXử lý sự cố:\n1. Cho phép ứng dụng truy cập Micro và Camera\n2. Kiểm tra kết nối internet (cần ít nhất 1 Mbps)\n3. Đảm bảo đối phương đang online\n4. Thử bật/tắt Wifi rồi kết nối lại\n\nVẫn gặp lỗi? Mô tả chi tiết để hỗ trợ thêm.",
    },
  ];

  // ─── TRANSLITERATION ───────────────────────────────────────────────────────
  /**
   * Remove Vietnamese diacritics and normalise to ASCII for keyword matching.
   * This allows users to type without diacritics and still get matched.
   */
  private transliterate(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[àáảãạăằắẳẵặâầấẩẫậ]/g, "a")
      .replace(/[èéẻẽẹêềếểễệ]/g, "e")
      .replace(/[ìíỉĩị]/g, "i")
      .replace(/[òóỏõọôồốổỗộơờớởỡợ]/g, "o")
      .replace(/[ùúủũụưừứửữự]/g, "u")
      .replace(/[ỳýỷỹỵ]/g, "y")
      .replace(/đ/g, "d")
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
          "Xin lỗi, tôi chưa hiểu rõ câu hỏi của bạn. Bạn có thể mô tả chi tiết hơn không?\n\nHoặc chọn một trong các chủ đề phổ biến:\n• Quên mật khẩu\n• Thêm bạn bè\n• Tạo nhóm chat\n• Vấn đề tài khoản\n• Liên hệ nhân viên hỗ trợ",
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
