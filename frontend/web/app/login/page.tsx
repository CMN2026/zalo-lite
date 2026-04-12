"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/auth";
import { login as loginRequest, saveAuthSession } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await loginRequest(identifier, password);

      console.log("✅ Login successful:", response.data);

      // Save token + current user in a unified session shape.
      saveAuthSession(response.data.token, response.data.user);

      // Update auth context
      authLogin(response.data.user);

      // Redirect to chat
      router.push("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Đăng nhập thất bại. Vui lòng thử lại.";
      console.error("Login error:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-4">
      {/* Logo + Title */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4">
          +
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Zalo Lite</h1>
        <p className="text-slate-500">Sign In</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email/Phone */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              EMAIL ADDRESS OR PHONE NUMBER
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@example.com"
              required
              className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                PASSWORD
              </label>
              <a href="#" className="text-xs text-blue-600 hover:text-blue-700">
                Forgot?
              </a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Remember */}
          <div className="flex items-center">
            <input type="checkbox" id="remember" className="w-4 h-4 rounded" />
            <label htmlFor="remember" className="ml-2 text-sm text-slate-600">
              Remember me
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60 mt-6"
          >
            {loading ? "SIGNING IN..." : "SIGN IN"}
          </button>
        </form>

<<<<<<< HEAD
        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
=======
        {/* Footer */}
        <div className="text-center text-sm text-slate-500 mt-6">
          Don&apos;t have an account?{" "}
          <span
            onClick={() => router.push("/register")}
            className="text-blue-600 cursor-pointer"
          >
            Sign Up
          </span>
>>>>>>> 41cff5b2fcba6bd3c43fc945ec8ea6a0e6253ec0
        </div>

        {/* Social Buttons */}
        <div className="flex gap-3">
          <button className="flex-1 border border-slate-300 rounded-lg py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            Google
          </button>
          <button className="flex-1 border border-slate-300 rounded-lg py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            Facebook
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-600 mt-6">
          Don&apos;t have an account?{" "}
          <a
            href="/register"
            className="text-blue-600 font-semibold hover:text-blue-700"
          >
            Sign Up
          </a>
        </div>
      </div>

      {/* Copyright */}
      <p className="text-xs text-slate-400 mt-8">
        © 2024 Zalo Lite. All rights reserved.
      </p>

      {/* Test Accounts Info */}
      <div className="mt-10 max-w-md text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="font-semibold text-slate-700 mb-2">Test Accounts</p>
        <p className="mb-2">
          <strong>admin@example.com</strong>
          <br />
          <strong>usera@example.com</strong>
          <br />
          <strong>userb@example.com</strong>
          <br />
          <strong>userc@example.com</strong>
        </p>
        <p>
          <strong>Password:</strong> test12345
        </p>
      </div>
    </div>
  );
}
