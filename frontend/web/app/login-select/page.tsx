"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginSelectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="text-center text-white">
        <h1 className="text-4xl font-bold mb-4">Zalo Lite</h1>
        <p className="text-lg text-blue-100">Đang chuyển hướng...</p>
      </div>
    </div>
  );
}
