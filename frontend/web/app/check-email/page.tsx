"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthCard from "../components/AuthCard";

export default function CheckEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResend = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch(
        "http://localhost:3001/auth/resend-verification",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || "Có lỗi xảy ra");
        return;
      }
      setMessage("Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư.");
    } catch (err) {
      console.error(err);
      setError("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="OTT Care" subtitle="Check Your Email">
      <div className="space-y-4">
        <p>
          Một email xác thực đã được gửi tới <strong>{email}</strong>. Vui lòng
          kiểm tra hộp thư và nhấp vào liên kết để hoàn tất đăng ký.
        </p>

        {message && <div className="text-green-600">{message}</div>}
        {error && <div className="text-red-600">{error}</div>}

        <button
          className="w-full bg-blue-600 text-white py-2 rounded-lg"
          onClick={handleResend}
          disabled={loading || !email}
        >
          {loading ? "Sending..." : "Gửi lại email xác thực"}
        </button>
      </div>
    </AuthCard>
  );
}
