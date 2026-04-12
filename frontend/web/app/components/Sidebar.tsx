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
}

export default function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUser(getSavedAuthUser());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const initials = useMemo(() => {
    const source = user?.fullName || user?.email || "U";
    return source
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user]);

  function handleLogout() {
    clearAuthSession();
    setUser(null);
    router.push("/login");
  }

  return (
    <div className="w-16 bg-blue-600 flex flex-col items-center py-5 text-white/70 gap-5 z-50">
      <button
        onClick={() => setCurrentView("profile")}
        title={user ? user.fullName : "Profile"}
        className="w-10 h-10 rounded-full bg-white/20 overflow-hidden border border-blue-400 flex items-center justify-center text-sm font-bold text-white"
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.fullName}
            className="w-full h-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      <div
        onClick={() => setCurrentView("chat")}
        className={`cursor-pointer p-2 rounded-lg transition-colors ${currentView === "chat" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
      >
        <MessageSquare className="w-6 h-6" />
      </div>

      <div
        onClick={() => setCurrentView("chatbot")}
        className={`cursor-pointer p-2 rounded-lg transition-colors ${currentView === "chatbot" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
      >
        <Bot className="w-6 h-6" />
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
