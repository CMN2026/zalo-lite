"use client";

import React from "react";
import { LogOut } from "lucide-react";

interface UserSwitcherProps {
  currentUserId: string;
  onUserChange: (userId: string) => void;
}

export default function UserSwitcher({
  currentUserId,
  onUserChange,
}: UserSwitcherProps) {
  return (
    <div className="p-4 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-blue-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
          {currentUserId === "user-1"
            ? "1️⃣"
            : currentUserId === "user-2"
              ? "2️⃣"
              : "3️⃣"}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Đăng nhập: <span className="text-blue-600">{currentUserId}</span>
          </p>
          <p className="text-xs text-slate-500">Chuyển tài khoản để test</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onUserChange("user-1")}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            currentUserId === "user-1"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white text-slate-700 border border-slate-200 hover:border-blue-400"
          }`}
        >
          Tài khoản 1️⃣
        </button>

        <button
          onClick={() => onUserChange("user-2")}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            currentUserId === "user-2"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white text-slate-700 border border-slate-200 hover:border-blue-400"
          }`}
        >
          Tài khoản 2️⃣
        </button>

        <button
          onClick={() => onUserChange("user-3")}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            currentUserId === "user-3"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white text-slate-700 border border-slate-200 hover:border-blue-400"
          }`}
        >
          Tài khoản 3️⃣
        </button>

        <button className="px-4 py-2 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 font-medium text-sm flex items-center gap-2">
          <LogOut className="w-4 h-4" />
          Đăng Xuất
        </button>
      </div>
    </div>
  );
}
