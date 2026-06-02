"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
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
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const t =
    language === "en"
      ? {
          signIn: "Sign In",
          idLabel: "Email Address Or Phone Number",
          password: "Password",
          forgot: "Forgot?",
          remember: "Remember me",
          signingIn: "Signing in...",
          googleFail: "Google sign-in failed.",
          noGoogleToken: "Google token was not received.",
          googleConfigMissing:
            "Missing `NEXT_PUBLIC_GOOGLE_CLIENT_ID` configuration to enable Google sign-in.",
          noAccount: "Don't have an account?",
          signUp: "Sign Up",
          copyright: "© 2024 Zalo Lite. All rights reserved.",
          showPassword: "Show password",
          hidePassword: "Hide password",
          loginFailed: "Sign-in failed. Please try again.",
          invalidCredentials: "Incorrect account or password.",
          accountInactive: "Account has been deactivated.",
          invalidLoginData: "Invalid login data.",
          invalidSession: "Invalid login session.",
          serverConfigError: "Server connection error. Please check API configuration.",
          googleInvalidToken: "Invalid Google token.",
          googleEmailNotVerified: "Google email is not verified.",
          googleNotConfigured: "Google OAuth is not configured on server.",
          usePasswordLogin:
            "This email already has an account. Please sign in with password.",
        }
      : {
          signIn: "Đăng nhập",
          idLabel: "Email hoặc số điện thoại",
          password: "Mật khẩu",
          forgot: "Quên mật khẩu?",
          remember: "Ghi nhớ đăng nhập",
          signingIn: "Đang đăng nhập...",
          googleFail: "Đăng nhập Google thất bại.",
          noGoogleToken: "Không nhận được Google token.",
          googleConfigMissing:
            "Thiếu cấu hình `NEXT_PUBLIC_GOOGLE_CLIENT_ID` để bật đăng nhập Google.",
          noAccount: "Chưa có tài khoản?",
          signUp: "Đăng ký",
          copyright: "© 2024 Zalo Lite. All rights reserved.",
          showPassword: "Hiện mật khẩu",
          hidePassword: "Ẩn mật khẩu",
          loginFailed: "Đăng nhập thất bại. Vui lòng thử lại.",
          invalidCredentials: "Sai thông tin tài khoản hoặc mật khẩu.",
          accountInactive: "Tài khoản đã bị vô hiệu hóa.",
          invalidLoginData: "Dữ liệu đăng nhập không hợp lệ.",
          invalidSession: "Phiên đăng nhập không hợp lệ.",
          serverConfigError: "Lỗi kết nối máy chủ. Vui lòng kiểm tra cấu hình API.",
          googleInvalidToken: "Google token không hợp lệ.",
          googleEmailNotVerified: "Email Google chưa được xác minh.",
          googleNotConfigured: "Máy chủ chưa cấu hình Google OAuth.",
          usePasswordLogin:
            "Email này đã đăng ký tài khoản. Vui lòng đăng nhập bằng mật khẩu.",
        };

  useEffect(() => {
    if (typeof document === "undefined") return;
    setLanguage(document.documentElement.lang === "en" ? "en" : "vi");
  }, []);

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
            : t.googleFail;
        const errorMap: Record<string, string> = {
          invalid_google_token: t.googleInvalidToken,
          google_email_not_verified: t.googleEmailNotVerified,
          google_auth_not_configured: t.googleNotConfigured,
          account_inactive: t.accountInactive,
          validation_error: t.invalidLoginData,
          email_registered_use_password_login: t.usePasswordLogin,
          api_response_is_not_json_check_api_base_url:
            t.serverConfigError,
        };
        setError(errorMap[rawMessage] ?? t.googleFail);
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
          setError(t.noGoogleToken);
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
          : t.loginFailed;
      const errorMap: Record<string, string> = {
        invalid_credentials: t.invalidCredentials,
        account_inactive: t.accountInactive,
        validation_error: t.invalidLoginData,
        missing_local_session: t.invalidSession,
        api_response_is_not_json_check_api_base_url:
          t.serverConfigError,
      };
      const message = errorMap[rawMessage] ?? t.loginFailed;
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
        <Image
          src="/auth-logo.png"
          alt="Zalo Lite logo"
          width={64}
          height={64}
          className="mb-4 rounded-2xl"
          priority
        />
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Zalo Lite</h1>
        <p className="text-slate-500">{t.signIn}</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email/Phone */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              {t.idLabel}
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
                {t.password}
              </label>
              <a href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700">
                {t.forgot}
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
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                title={showPassword ? t.hidePassword : t.showPassword}
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
              {t.remember}
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
            {loading ? t.signingIn : t.signIn}
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
              {t.googleConfigMissing}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-600 mt-6">
          {t.noAccount}{" "}
          <a
            href="/register"
            className="text-blue-600 font-semibold hover:text-blue-700"
          >
            {t.signUp}
          </a>
        </div>
      </div>

      {/* Copyright */}
      <p className="text-xs text-slate-400 mt-8">
        {t.copyright}
      </p>

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initializeGoogleButton}
      />
    </div>
  );
}
