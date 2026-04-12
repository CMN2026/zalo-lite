import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart2,
  Bot,
  FileText,
  LogIn,
  LogOut,
  MessageSquare,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { clearAuthSession, getSavedAuthUser, type AuthUser } from "../lib/auth";

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  unreadCount?: number;
}

export default function Sidebar({
  currentView,
  setCurrentView,
  unreadCount = 0,
}: SidebarProps) {
  return (
    <div className="w-16 bg-blue-600 flex flex-col items-center py-6 text-white/70 space-y-8 z-50">
      <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden mb-4 border border-blue-400">
        <img
          src="https://i.pravatar.cc/150?u=admin"
          alt="Admin"
          className="w-full h-full object-cover"
        />
      </div>

      <div
        onClick={() => setCurrentView("chat")}
        className={`relative cursor-pointer p-2 rounded-lg transition-colors ${currentView === "chat" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
      >
        <MessageSquare className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] leading-5 text-center font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>

      <div
        onClick={() => setCurrentView("history")}
        className={`cursor-pointer p-2 rounded-lg transition-colors ${currentView === "history" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
      >
        <FileText className="w-6 h-6" />
      </div>

      <div
        onClick={() => setCurrentView("stats")}
        className={`cursor-pointer p-2 rounded-lg transition-colors ${currentView === "stats" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
      >
        <BarChart2 className="w-6 h-6" />
      </div>

      <div
        onClick={() => setCurrentView("friends")}
        className={`cursor-pointer p-2 rounded-lg transition-colors ${currentView === "friends" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
      >
        <Users className="w-6 h-6" />
      </div>

      <div className="flex-grow"></div>
      <div
        onClick={() => setCurrentView("profile")}
        className={`cursor-pointer p-2 rounded-lg transition-colors ${currentView === "profile" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
      >
        <UserRound className="w-6 h-6" />
      </div>
      <Settings className="w-6 h-6 hover:text-white cursor-pointer transition-colors" />
      {user ? (
        <button
          onClick={handleLogout}
          title="Sign out"
          className="p-2 rounded-lg bg-white/15 text-white hover:bg-white hover:text-blue-600 transition-colors"
        >
          <LogOut className="w-6 h-6" />
        </button>
      ) : (
        <button
          onClick={() => router.push("/login")}
          title="Sign in"
          className="p-2 rounded-lg hover:text-white transition-colors"
        >
          <LogIn className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
