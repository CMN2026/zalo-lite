"use client";
import { useState, type FormEvent } from "react";
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

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim() || !email.trim() || !password) {
      setError("Vui lòng nhập đầy đủ họ tên, email và mật khẩu");
      return;
    }

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    if (phone && (phone.trim().length < 8 || phone.trim().length > 20)) {
      setError("Số điện thoại phải có từ 8 đến 20 ký tự");
      return;
    }

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
          setError("Mật khẩu phải có từ 8 đến 72 ký tự");
        } else if (firstError?.field === "email") {
          setError("Email không đúng định dạng");
        } else if (firstError?.field === "fullName") {
          setError("Họ tên phải có từ 2 đến 100 ký tự");
        } else if (firstError?.field === "phone") {
          setError("Số điện thoại phải có từ 8 đến 20 ký tự");
        } else {
          setError("Dữ liệu không hợp lệ, vui lòng kiểm tra lại thông tin");
        }
      } else {
        const errorMap: Record<string, string> = {
          email_already_registered: "Email này đã được sử dụng.",
          phone_already_used: "Số điện thoại này đã được sử dụng.",
          email_service_not_configured:
            "Hệ thống email chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
          register_pending_verification:
            "Tài khoản đang chờ xác minh. Vui lòng kiểm tra email OTP.",
          api_response_is_not_json_check_api_base_url:
            "Lỗi kết nối máy chủ. Vui lòng kiểm tra cấu hình API.",
        };
        setError(errorMap[authError.message] ?? "Không thể đăng ký. Vui lòng thử lại.");
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
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Confirm Password
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
                aria-label={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
                title={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
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
