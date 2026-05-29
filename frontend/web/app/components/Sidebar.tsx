import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  LogIn,
  LogOut,
  MessageSquare,
  Newspaper,
  Settings,
  Users,
} from "lucide-react";
import { clearAuthSession, getSavedAuthUser, type AuthUser } from "../lib/auth";
import type { AppLanguage } from "./SettingsView";

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  unreadCount?: number;
  language?: AppLanguage;
}

export default function Sidebar({
  currentView,
  setCurrentView,
  unreadCount = 0,
  language = "vi",
}: Readonly<SidebarProps>) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getSavedAuthUser());
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

  const labels =
    language === "en"
      ? {
          profile: "Profile",
          chats: "Chats",
          posts: "Posts",
          friends: "Friends",
          chatbot: "Chatbot",
          settings: "Settings",
          logout: "Sign out",
          login: "Sign in",
        }
      : {
          profile: "Trang cá nhân",
          chats: "Trò chuyện",
          posts: "Bảng tin",
          friends: "Bạn bè",
          chatbot: "Chatbot",
          settings: "Cài đặt",
          logout: "Đăng xuất",
          login: "Đăng nhập",
        };

  return (
    <div className="w-16 bg-blue-600 flex flex-col items-center py-6 text-white/70 space-y-8 z-50">
      <button
        onClick={() => setCurrentView("profile")}
        title={user ? user.fullName : labels.profile}
        className="w-10 h-10 rounded-full bg-white/20 overflow-hidden mb-4 border border-blue-400 flex items-center justify-center text-sm font-bold text-white"
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

      <button
        onClick={() => setCurrentView("chat")}
        title={labels.chats}
        className={`relative cursor-pointer p-2 rounded-lg transition-colors ${currentView === "chat" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
      >
        <MessageSquare className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] leading-5 text-center font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <button
        onClick={() => setCurrentView("posts")}
        className={`cursor-pointer p-2 rounded-lg transition-colors ${currentView === "posts" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
        title={labels.posts}
      >
        <Newspaper className="w-6 h-6" />
      </button>

      <button
        onClick={() => setCurrentView("friends")}
        title={labels.friends}
        className={`cursor-pointer p-2 rounded-lg transition-colors ${currentView === "friends" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
      >
        <Users className="w-6 h-6" />
      </button>

      <button
        onClick={() => setCurrentView("chatbot")}
        title={labels.chatbot}
        className={`cursor-pointer p-2 rounded-lg transition-colors ${currentView === "chatbot" ? "text-blue-600 bg-white shadow-sm" : "hover:text-white"}`}
      >
        <Bot className="w-6 h-6" />
      </button>

      <div className="grow"></div>
      <button
        onClick={() => setCurrentView("settings")}
        title={labels.settings}
        className={`mb-2 p-2 rounded-lg transition-colors ${currentView === "settings" ? "text-blue-600 bg-white shadow-sm" : "bg-white/15 text-white hover:bg-white hover:text-blue-600"}`}
      >
        <Settings className="w-6 h-6" />
      </button>
      {user ? (
        <button
          onClick={handleLogout}
          title={labels.logout}
          className="p-2 rounded-lg bg-white/15 text-white hover:bg-white hover:text-blue-600 transition-colors"
        >
          <LogOut className="w-6 h-6" />
        </button>
      ) : (
        <button
          onClick={() => router.push("/login")}
          title={labels.login}
          className="p-2 rounded-lg hover:text-white transition-colors"
        >
          <LogIn className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
