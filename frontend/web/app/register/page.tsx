"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { register, saveAuthSession } from "../lib/auth";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); // ✅ giữ phone
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);

    try {
      const response = await register({
        fullName,
        email,
        phone: phone || undefined, // ✅ gửi nếu có
        password,
        avatarUrl: undefined, // ✅ luôn undefined
      });

      saveAuthSession(response.data.token, response.data.user);
      router.push("/");
    } catch (err) {
      const authError = err as Error & {
        errors?: Array<{ field: string; message: string }>;
      };

      if (authError.message === "email_already_registered") {
        setError("Email này đã được sử dụng");
      } else if (authError.message === "phone_already_used") {
        setError("Số điện thoại này đã được sử dụng");
      } else if (authError.message === "validation_error") {
        setError(authError.errors?.[0]?.message ?? "Dữ liệu không hợp lệ");
      } else {
        setError("Không thể đăng ký. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-4">
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
          +
        </div>
        <h1 className="text-2xl font-semibold mt-3">OTT Care</h1>
        <p className="text-sm text-slate-500">Create an Account</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
        <form onSubmit={handleRegister} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ✅ Phone (giữ lại) */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0911222333"
              className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Terms */}
          <div className="flex items-start text-sm text-slate-600">
            <input type="checkbox" className="mr-2 mt-1" />
            <span>
              I agree to the{" "}
              <span className="text-blue-600 cursor-pointer">
                Terms of Service
              </span>{" "}
              and{" "}
              <span className="text-blue-600 cursor-pointer">
                Privacy Policy
              </span>
            </span>
          </div>

          {/* Error */}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-70"
          >
            {loading ? "Đang tạo tài khoản..." : "Create Account"}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <span
            onClick={() => router.push("/login")}
            className="text-blue-600 cursor-pointer"
          >
            Sign In
          </span>
        </div>

        {/* Social */}
        <div className="flex gap-3 mt-4">
          <button className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">
            Google
          </button>
          <button className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">
            Facebook
          </button>
        </div>
      </div>

      {/* Bottom */}
      <div className="text-xs text-slate-400 mt-6 text-center">
        © 2024 OTT Care. All rights reserved.
      </div>
    </div>
  );
}
