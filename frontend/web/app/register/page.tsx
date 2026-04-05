"use client";
import AuthCard from "../components/AuthCard";

export default function RegisterPage() {
  const handleRegister = (e: any) => {
    e.preventDefault();
    alert("Register success (demo)");
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
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="John Doe"
          />
        </div>

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

        <div>
          <label className="text-sm">Confirm Password</label>
          <input
            type="password"
            className="w-full mt-1 p-2 border rounded-lg"
            placeholder="********"
          />
        </div>

        <div className="text-sm">
          <label>
            <input type="checkbox" className="mr-1" /> I agree to Terms & Privacy
          </label>
        </div>

        <button className="w-full bg-blue-600 text-white py-2 rounded-lg">
          Create Account
        </button>
      </form>
    </AuthCard>
  );
}
