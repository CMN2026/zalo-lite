"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/auth";
import { login as loginRequest, loginWithGoogle, saveAuthSession } from "../lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (input: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              text?:
                | "signin_with"
                | "signup_with"
                | "continue_with"
                | "signin";
              size?: "large" | "medium" | "small";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setError("");
      setGoogleLoading(true);
      try {
        const response = await loginWithGoogle({ idToken: credential });
        saveAuthSession(response.data.token, response.data.user);
        authLogin(response.data.user);
        router.push("/");
      } catch (err: unknown) {
        const rawMessage =
          err instanceof Error && err.message
            ? err.message
            : "Đăng nhập Google thất bại.";
        const errorMap: Record<string, string> = {
          invalid_google_token: "Google token không hợp lệ.",
          google_email_not_verified: "Email Google chưa được xác minh.",
          google_auth_not_configured: "Máy chủ chưa cấu hình Google OAuth.",
          account_inactive: "Tài khoản đã bị vô hiệu hóa.",
          validation_error: "Dữ liệu đăng nhập Google không hợp lệ.",
          api_response_is_not_json_check_api_base_url:
            "Lỗi kết nối máy chủ. Vui lòng kiểm tra cấu hình API.",
        };
        setError(errorMap[rawMessage] ?? "Đăng nhập Google thất bại.");
      } finally {
        setGoogleLoading(false);
      }
    },
    [authLogin, router],
  );

  const initializeGoogleButton = useCallback(() => {
    if (!googleClientId || !googleButtonRef.current || !window.google) {
      return;
    }

    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        const credential = response.credential?.trim();
        if (!credential) {
          setError("Không nhận được Google token.");
          return;
        }
        void handleGoogleCredential(credential);
      },
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: "standard",
      theme: "outline",
      text: "signin_with",
      size: "large",
      shape: "rectangular",
      logo_alignment: "left",
      width: 360,
    });
  }, [googleClientId, handleGoogleCredential]);

  useEffect(() => {
    if (window.google) {
      initializeGoogleButton();
    }
  }, [initializeGoogleButton]);

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
      const rawMessage =
        err instanceof Error && err.message
          ? err.message
          : "Đăng nhập thất bại. Vui lòng thử lại.";
      const errorMap: Record<string, string> = {
        invalid_credentials: "Sai thông tin tài khoản hoặc mật khẩu.",
        account_inactive: "Tài khoản đã bị vô hiệu hóa.",
        validation_error: "Dữ liệu đăng nhập không hợp lệ.",
        missing_local_session: "Phiên đăng nhập không hợp lệ.",
        api_response_is_not_json_check_api_base_url:
          "Lỗi kết nối máy chủ. Vui lòng kiểm tra cấu hình API.",
      };
      const message = errorMap[rawMessage] ?? "Đăng nhập thất bại. Vui lòng thử lại.";
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
              <a href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700">
                Forgot?
              </a>
            </div>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
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

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
        </div>

        {/* Google Sign-In */}
        <div className="flex justify-center">
          {googleClientId ? (
            <div className="w-full flex justify-center">
              <div ref={googleButtonRef} className={googleLoading ? "pointer-events-none opacity-60" : ""} />
            </div>
          ) : (
            <p className="text-sm text-amber-600 text-center">
              Thiếu cấu hình `NEXT_PUBLIC_GOOGLE_CLIENT_ID` để bật đăng nhập Google.
            </p>
          )}
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

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initializeGoogleButton}
      />
    </div>
  );
}
