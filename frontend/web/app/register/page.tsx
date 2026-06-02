"use client";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { register } from "../lib/auth";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); // ✅ giữ phone
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const t =
    language === "en"
      ? {
          title: "Create an Account",
          fullName: "Full Name",
          email: "Email Address",
          phone: "Phone Number",
          password: "Password",
          confirmPassword: "Confirm Password",
          terms: "I agree to the Terms of Service and Privacy Policy",
          createAccount: "Create Account",
          creating: "Creating account...",
          showPassword: "Show password",
          hidePassword: "Hide password",
          showConfirmPassword: "Show confirm password",
          hideConfirmPassword: "Hide confirm password",
          agreePrefix: "I agree to the",
          termsOfService: "Terms of Service",
          and: "and",
          privacyPolicy: "Privacy Policy",
          copyright: "© 2024 Zalo Lite. All rights reserved.",
          hasAccount: "Already have an account?",
          signIn: "Sign In",
          requiredFields: "Please enter full name, email and password.",
          minPassword: "Password must be at least 8 characters.",
          phoneLength: "Phone number must be between 8 and 20 characters.",
          mismatch: "Password confirmation does not match.",
          invalidData: "Invalid data, please check your input.",
          registerFail: "Unable to register. Please try again.",
          emailUsed: "This email is already used.",
          phoneUsed: "This phone number is already used.",
          emailService:
            "Email service is not configured. Please contact administrator.",
          pendingVerify:
            "Account is pending verification. Please check OTP email.",
          apiError:
            "Server connection error. Please check API configuration.",
        }
      : {
          title: "Tạo tài khoản",
          fullName: "Họ và tên",
          email: "Email",
          phone: "Số điện thoại",
          password: "Mật khẩu",
          confirmPassword: "Xác nhận mật khẩu",
          terms: "Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật",
          createAccount: "Tạo tài khoản",
          creating: "Đang tạo tài khoản...",
          showPassword: "Hiện mật khẩu",
          hidePassword: "Ẩn mật khẩu",
          showConfirmPassword: "Hiện mật khẩu xác nhận",
          hideConfirmPassword: "Ẩn mật khẩu xác nhận",
          agreePrefix: "Tôi đồng ý với",
          termsOfService: "Điều khoản dịch vụ",
          and: "và",
          privacyPolicy: "Chính sách bảo mật",
          copyright: "© 2024 Zalo Lite. Đã đăng ký bản quyền.",
          hasAccount: "Đã có tài khoản?",
          signIn: "Đăng nhập",
          requiredFields: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu",
          minPassword: "Mật khẩu phải có ít nhất 8 ký tự",
          phoneLength: "Số điện thoại phải có từ 8 đến 20 ký tự",
          mismatch: "Mật khẩu xác nhận không khớp",
          invalidData: "Dữ liệu không hợp lệ, vui lòng kiểm tra lại thông tin",
          registerFail: "Không thể đăng ký. Vui lòng thử lại.",
          emailUsed: "Email này đã được sử dụng.",
          phoneUsed: "Số điện thoại này đã được sử dụng.",
          emailService:
            "Hệ thống email chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
          pendingVerify:
            "Tài khoản đang chờ xác minh. Vui lòng kiểm tra email OTP.",
          apiError:
            "Lỗi kết nối máy chủ. Vui lòng kiểm tra cấu hình API.",
        };

  useEffect(() => {
    if (typeof document === "undefined") return;
    setLanguage(document.documentElement.lang === "en" ? "en" : "vi");
  }, []);

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim() || !email.trim() || !password) {
      setError(t.requiredFields);
      return;
    }

    if (password.length < 8) {
      setError(t.minPassword);
      return;
    }

    if (phone && (phone.trim().length < 8 || phone.trim().length > 20)) {
      setError(t.phoneLength);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.mismatch);
      return;
    }

    setLoading(true);

    try {
      const response = await register({
        fullName,
        email,
        phone: phone || undefined, // ✅ gửi nếu có
        password,
        avatarUrl: undefined,
      });

      const params = new URLSearchParams({
        session: response.data.verificationSessionId,
        email: response.data.email,
        expiresAt: response.data.expiresAt,
      });
      router.push(`/register/verify?${params.toString()}`);
    } catch (err) {
      const authError = err as Error & {
        errors?: Array<{ field: string; message: string }>;
      };
      if (authError.message === "validation_error") {
        const firstError = authError.errors?.[0];
        if (firstError?.field === "password") {
          setError(language === "en" ? "Password must be 8-72 characters." : "Mật khẩu phải có từ 8 đến 72 ký tự");
        } else if (firstError?.field === "email") {
          setError(language === "en" ? "Invalid email format." : "Email không đúng định dạng");
        } else if (firstError?.field === "fullName") {
          setError(language === "en" ? "Full name must be 2-100 characters." : "Họ tên phải có từ 2 đến 100 ký tự");
        } else if (firstError?.field === "phone") {
          setError(t.phoneLength);
        } else {
          setError(t.invalidData);
        }
      } else {
        const errorMap: Record<string, string> = {
          email_already_registered: t.emailUsed,
          phone_already_used: t.phoneUsed,
          email_service_not_configured: t.emailService,
          register_pending_verification: t.pendingVerify,
          api_response_is_not_json_check_api_base_url:
            t.apiError,
        };
        setError(errorMap[authError.message] ?? t.registerFail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-4">
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <Image
          src="/auth-logo.png"
          alt="Zalo Lite logo"
          width={64}
          height={64}
          className="rounded-2xl"
          priority
        />
        <h1 className="text-2xl font-semibold mt-3">Zalo Lite</h1>
        <p className="text-sm text-slate-500">{t.title}</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
        <form onSubmit={handleRegister} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              {t.fullName}
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
              {t.email}
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
              {t.phone}
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
              {t.password}
            </label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                title={showPassword ? t.hidePassword : t.showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              {t.confirmPassword}
            </label>
            <div className="relative mt-1">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                aria-label={showConfirmPassword ? t.hideConfirmPassword : t.showConfirmPassword}
                title={showConfirmPassword ? t.hideConfirmPassword : t.showConfirmPassword}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Terms */}
          <div className="flex items-start text-sm text-slate-600">
            <input type="checkbox" className="mr-2 mt-1" />
            <span>
              {t.agreePrefix}{" "}
              <span className="text-blue-600 cursor-pointer">
                {t.termsOfService}
              </span>{" "}
              {t.and}{" "}
              <span className="text-blue-600 cursor-pointer">
                {t.privacyPolicy}
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
            {loading ? t.creating : t.createAccount}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 mt-6">
          {t.hasAccount}{" "}
          <span
            onClick={() => router.push("/login")}
            className="text-blue-600 cursor-pointer"
          >
            {t.signIn}
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
        {t.copyright}
      </div>
    </div>
  );
}
