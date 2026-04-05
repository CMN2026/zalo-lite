"use client";
import { useState } from "react";
import AuthCard from "../components/AuthCard";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || "Có lỗi xảy ra, vui lòng thử lại");
        setLoading(false);
        return;
      }

      setMessage("Yêu cầu đã được gửi. Kiểm tra email để đặt lại mật khẩu.");
    } catch (err) {
      console.error("Forgot password error:", err);
      setError("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="OTT Care"
      subtitle="Forgot Password"
      footerText="Back to"
      footerLink="/login"
      footerLinkText="Sign In"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="name@example.com"
            required
          />
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}
        {message && <div className="text-green-600 text-sm">{message}</div>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-lg"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </AuthCard>
  );
}
