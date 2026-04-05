"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "../components/AuthCard";

export default function LoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:3001/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // BE throw error => res.ok = false => show error message
        if (data.message === "invalid_credentials") {
          setError("Tài khoản hoặc mật khẩu không chính xác");
        } else if (data.message === "account_inactive") {
          setError("Tài khoản chưa kích hoạt");
        } else {
          setError("Lỗi hệ thống");
        }
        return;
      }

      // save token
      localStorage.setItem("token", data.data.token);

      // save user (optional)
      localStorage.setItem("user", JSON.stringify(data.data.user));

      // redirect
      router.push("/");
    } catch (err) {
      setError("Có lỗi xảy ra, vui lòng thử lại");
      console.error("Login error:", err);
    }
  };

  return (
    <AuthCard
      title="OTT Care"
      subtitle="Sign In to OTT Care"
      footerText="Don't have an account?"
      footerLink="/register"
      footerLinkText="Sign Up"
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-sm">Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="Enter your phone..."
          />
        </div>

        <div>
          <label className="text-sm">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="Enter your password..."
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label>
            <input type="checkbox" className="mr-1" /> Remember me
          </label>
          <span className="text-blue-600 cursor-pointer">Forgot password?</span>
        </div>

        {/* ✅ HIỂN THỊ ERROR */}
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button className="w-full bg-blue-600 text-white py-2 rounded-lg">
          Sign In
        </button>
      </form>
    </AuthCard>
  );
}
