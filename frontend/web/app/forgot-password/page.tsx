"use client";

import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "../lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await requestPasswordReset(email.trim());
      setSuccess(
        `Đã gửi link đặt lại mật khẩu đến ${response.data.email}. Link hết hạn sau ${response.data.expiresInMinutes} phút.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "request_failed";
      if (message === "email_not_found") {
        setError("Email này chưa được đăng ký tài khoản.");
      } else {
        setError("Không thể gửi yêu cầu đặt lại mật khẩu.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center">Quên mật khẩu</h1>
        <p className="text-sm text-slate-500 text-center mt-2">
          Nhập email đăng ký để nhận link đặt lại mật khẩu.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
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
            {loading ? "ĐANG GỬI..." : "YÊU CẦU RESET MẬT KHẨU"}
          </button>
        </form>
      </div>
    </div>
  );
}

