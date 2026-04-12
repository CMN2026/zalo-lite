"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login, saveAuthSession } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login(identifier, password);
      saveAuthSession(response.data.token, response.data.user);
      router.push("/");
    } catch (err) {
      const authError = err as Error & { errors?: Array<{ field: string; message: string }> };

      if (authError.message === "invalid_credentials") {
        setError("Email/số điện thoại hoặc mật khẩu không đúng");
      } else if (authError.message === "account_inactive") {
        setError("Tài khoản đang bị vô hiệu hóa");
      } else if (authError.message === "validation_error") {
        setError(authError.errors?.[0]?.message ?? "Dữ liệu đăng nhập không hợp lệ");
      } else {
        setError("Không thể đăng nhập. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-4">
      {/* Logo + Title */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
          +
        </div>
        <h1 className="text-2xl font-semibold mt-3">OTT Care</h1>
        <p className="text-sm text-slate-500">Sign In to OTT Care</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Email address or phone number
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@example.com or 0123456789"
              className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-500 uppercase">
                Password
              </label>
              <span className="text-sm text-blue-600 cursor-pointer">
                Forgot password?
              </span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Remember */}
          <div className="flex items-center text-sm text-slate-600">
            <input type="checkbox" className="mr-2" />
            Remember me
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-70"
          >
            {loading ? "Đang đăng nhập..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 mt-6">
          Don&apos;t have an account?{" "}
          <span
            onClick={() => router.push("/register")}
            className="text-blue-600 cursor-pointer"
          >
            Sign Up
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
