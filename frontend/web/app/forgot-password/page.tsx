"use client";

import { useEffect, useState, type FormEvent } from "react";
import { requestPasswordReset } from "../lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const t =
    language === "en"
      ? {
          title: "Forgot password",
          subtitle: "Enter your registered email to receive a password reset link.",
          email: "Email",
          emailPlaceholder: "name@example.com",
          sending: "SENDING...",
          submit: "REQUEST PASSWORD RESET",
          emailNotFound: "This email is not registered.",
          accountInactive: "This account has been deactivated.",
          validationError: "Invalid email.",
          emailService:
            "Email service is not configured. Please contact administrator.",
          apiError:
            "Server connection error. Please check API configuration.",
          fallbackError: "Unable to send password reset request.",
          successPrefix: "Password reset link has been sent to",
          successSuffix: "The link expires in",
          successMinute: "minutes.",
        }
      : {
          title: "Quên mật khẩu",
          subtitle: "Nhập email đăng ký để nhận link đặt lại mật khẩu.",
          email: "Email",
          emailPlaceholder: "name@example.com",
          sending: "ĐANG GỬI...",
          submit: "YÊU CẦU RESET MẬT KHẨU",
          emailNotFound: "Email này chưa được đăng ký tài khoản.",
          accountInactive: "Tài khoản đã bị vô hiệu hóa.",
          validationError: "Email không hợp lệ.",
          emailService:
            "Hệ thống email chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
          apiError:
            "Lỗi kết nối máy chủ. Vui lòng kiểm tra cấu hình API.",
          fallbackError: "Không thể gửi yêu cầu đặt lại mật khẩu.",
          successPrefix: "Đã gửi link đặt lại mật khẩu đến",
          successSuffix: "Link hết hạn sau",
          successMinute: "phút.",
        };

  useEffect(() => {
    if (typeof document === "undefined") return;
    setLanguage(document.documentElement.lang === "en" ? "en" : "vi");
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await requestPasswordReset(email.trim());
      setSuccess(
        `${t.successPrefix} ${response.data.email}. ${t.successSuffix} ${response.data.expiresInMinutes} ${t.successMinute}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "request_failed";
      const errorMap: Record<string, string> = {
        email_not_found: t.emailNotFound,
        account_inactive: t.accountInactive,
        validation_error: t.validationError,
        email_service_not_configured: t.emailService,
        api_response_is_not_json_check_api_base_url:
          t.apiError,
      };
      setError(errorMap[message] ?? t.fallbackError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center">{t.title}</h1>
        <p className="text-sm text-slate-500 text-center mt-2">
          {t.subtitle}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">{t.email}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          >
            {loading ? t.sending : t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
