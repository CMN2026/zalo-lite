"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  resendRegisterCode,
  saveAuthSession,
  verifyRegisterCode,
} from "../../lib/auth";
import { useAuth } from "../../contexts/auth";

const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 3;

export default function VerifyRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const sessionId = searchParams.get("session") ?? "";
  const email = searchParams.get("email") ?? "";
  const expiresAtValue = searchParams.get("expiresAt") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(RESEND_SECONDS);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => new Date(expiresAtValue));
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!sessionId || !email || Number.isNaN(expiresAt.getTime())) {
      router.replace("/register");
    }
  }, [email, expiresAt, router, sessionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setIsLocked(true);
        setError("Mã xác nhận đã hết hạn. Vui lòng đăng ký lại.");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const timeLeftLabel = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [secondsLeft]);

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLocked) {
      return;
    }

    setError("");
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Vui lòng nhập mã OTP gồm 6 chữ số");
      return;
    }

    setLoading(true);
    try {
      const response = await verifyRegisterCode({
        verificationSessionId: sessionId,
        code: code.trim(),
      });

      saveAuthSession(response.data.token, response.data.user);
      login(response.data.user);
      router.replace("/");
    } catch (err) {
      const authError = err as Error;
      if (authError.message === "verification_code_invalid") {
        const nextAttempt = attemptCount + 1;
        setAttemptCount(nextAttempt);
        if (nextAttempt >= MAX_ATTEMPTS) {
          setIsLocked(true);
          setError("Bạn đã nhập sai OTP 3 lần. Vui lòng đăng ký lại.");
        } else {
          setError(`Mã OTP không đúng. Bạn còn ${MAX_ATTEMPTS - nextAttempt} lần thử.`);
        }
      } else if (
        authError.message === "verification_code_expired" ||
        authError.message === "verification_failed_max_attempts" ||
        authError.message === "verification_session_inactive"
      ) {
        setIsLocked(true);
        setError("Phiên xác nhận không còn hiệu lực. Vui lòng đăng ký lại.");
      } else if (authError.message === "verification_session_not_found") {
        setIsLocked(true);
        setError("Không tìm thấy phiên xác nhận. Vui lòng đăng ký lại.");
      } else {
        setError("Không thể xác nhận mã. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || isLocked) {
      return;
    }

    setError("");
    setResendLoading(true);
    try {
      const response = await resendRegisterCode(sessionId);
      setResendCountdown(RESEND_SECONDS);
      setCode("");
      setAttemptCount(0);
      setIsLocked(false);
      setExpiresAt(new Date(response.data.expiresAt));
    } catch (err) {
      const authError = err as Error;
      if (authError.message === "resend_too_soon") {
        setResendCountdown(RESEND_SECONDS);
      } else if (
        authError.message === "verification_code_expired" ||
        authError.message === "verification_failed_max_attempts" ||
        authError.message === "verification_session_inactive"
      ) {
        setIsLocked(true);
        setError("Phiên xác nhận không còn hiệu lực. Vui lòng đăng ký lại.");
      } else {
        setError("Không thể gửi lại mã. Vui lòng thử lại.");
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
        <h1 className="text-2xl font-semibold text-center text-slate-900">Xác nhận email</h1>
        <p className="text-sm text-slate-600 text-center mt-2">
          Mã OTP đã được gửi đến <span className="font-semibold">{email}</span>
        </p>
        <p className="text-sm text-slate-500 text-center mt-1">
          Mã còn hiệu lực trong: <span className="font-semibold">{timeLeftLabel}</span>
        </p>

        <form onSubmit={handleVerify} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Mã OTP (6 số)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              disabled={isLocked}
              className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>

          {error ? <p className="text-red-500 text-sm text-center">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-70"
          >
            {loading ? "Đang xác nhận..." : "Xác nhận mã"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResend}
          disabled={resendCountdown > 0 || resendLoading || isLocked}
          className="w-full mt-3 py-3 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition disabled:opacity-60"
        >
          {resendLoading
            ? "Đang gửi lại..."
            : resendCountdown > 0
              ? `Gửi lại mã (${resendCountdown}s)`
              : "Gửi lại mã"}
        </button>

        <button
          type="button"
          onClick={() => router.replace("/register")}
          className="w-full mt-3 py-3 rounded-lg text-blue-600 font-semibold hover:bg-blue-50 transition"
        >
          Quay lại trang đăng ký
        </button>
      </div>
    </div>
  );
}
