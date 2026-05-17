"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

export default function ForceLogoutModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleForceLogout = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setMessage(customEvent.detail);
      setIsOpen(true);
    };

    window.addEventListener("force_logout", handleForceLogout);
    return () => {
      window.removeEventListener("force_logout", handleForceLogout);
    };
  }, []);

  const handleOk = () => {
    setIsOpen(false);
    window.location.href = "/login";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Đăng xuất</h2>
          <p className="text-slate-500 text-sm">{message}</p>
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={handleOk}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors"
          >
            Đăng nhập lại
          </button>
        </div>
      </div>
    </div>
  );
}
