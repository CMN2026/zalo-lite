"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "../lib/auth";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center text-slate-500">
            Đang tải...
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Liên kết không hợp lệ.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, newPassword });
      setSuccess("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.");
      window.setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "request_failed";
      const errorMap: Record<string, string> = {
        reset_token_invalid_or_expired:
          "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn (5 phút).",
        reset_token_missing: "Thiếu token đặt lại mật khẩu.",
        user_not_found: "Không tìm thấy người dùng.",
        validation_error: "Mật khẩu mới không hợp lệ.",
        api_response_is_not_json_check_api_base_url:
          "Lỗi kết nối máy chủ. Vui lòng kiểm tra cấu hình API.",
      };
      setError(errorMap[message] ?? "Không thể đặt lại mật khẩu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center">Đặt lại mật khẩu</h1>
        <p className="text-sm text-slate-500 text-center mt-2">
          Nhập mật khẩu mới để hoàn tất.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Mật khẩu mới</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? "ĐANG XỬ LÝ..." : "XÁC NHẬN"}
          </button>
        </form>
      </div>
    </div>
  );
}
