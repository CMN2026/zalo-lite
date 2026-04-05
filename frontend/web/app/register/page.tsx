"use client";
import { useState } from "react";
import AuthCard from "../components/AuthCard";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: any) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Mật khẩu không khớp");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone || "",
          password,
          full_name: fullName,
          email,
        }),
      });

      const data = await res.json().catch(() => null);
      console.log("Register response:", data);
      if (!res.ok) {
        setError(data?.message || "Có lỗi xảy ra, vui lòng thử lại");
        setLoading(false);
        return;
      }

      // Only navigate to check-email when backend indicated email was sent
      if (data?.verification_sent) {
        const redirectEmail = data?.user?.email || email;
        console.log("Redirect email:", redirectEmail);
        if (redirectEmail && redirectEmail.trim().length > 0) {
          router.push(`/check-email?email=${encodeURIComponent(redirectEmail)}`);
          return;
        }
      }

      router.push("/login");
    } catch (err) {
      console.error("Register error:", err);
      setError("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="OTT Care"
      subtitle="Create an Account"
      footerText="Already have an account?"
      footerLink="/login"
      footerLinkText="Sign In"
    >
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="text-sm">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="John Doe"
            required
          />
        </div>

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

        <div>
          <label className="text-sm">Phone (optional)</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="0123456789"
          />
        </div>

        <div>
          <label className="text-sm">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="********"
            required
          />
        </div>

        <div>
          <label className="text-sm">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="********"
            required
          />
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <div className="text-sm">
          <label>
            <input type="checkbox" className="mr-1" /> I agree to Terms &
            Privacy
          </label>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-lg"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Account"}
        </button>

        <div className="text-center text-sm mt-2">
          <a href="/forgot-password" className="text-blue-600 underline">
            Quên mật khẩu?
          </a>
        </div>
      </form>
    </AuthCard>
  );
}
