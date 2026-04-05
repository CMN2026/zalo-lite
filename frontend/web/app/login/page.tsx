"use client";
import { useRouter } from "next/navigation";
import AuthCard from "../components/AuthCard";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (e: any) => {
    e.preventDefault();
    alert("Login success (demo)");
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
          <label className="text-sm">Email Address</label>
          <input
            type="email"
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="name@example.com"
          />
        </div>

        <div>
          <label className="text-sm">Password</label>
          <input
            type="password"
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="********"
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label>
            <input type="checkbox" className="mr-1" /> Remember me
          </label>
          <span className="text-blue-600 cursor-pointer">Forgot password?</span>
        </div>

        <button className="w-full bg-blue-600 text-white py-2 rounded-lg">
          Sign In
        </button>
      </form>
    </AuthCard>
  );
}