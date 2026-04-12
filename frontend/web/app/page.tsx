"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../app/components/Sidebar";
import ChatView from "../app/components/ChatView";
import ChatbotView from "../app/components/ChatbotView";
import FriendsView from "../app/components/FriendsView";
import HistoryView from "../app/components/HistoryView";
import ProfileView from "../app/components/ProfileView";
import StatsView from "../app/components/StatsView";
import { getAuthToken } from "../app/lib/auth";

export default function DashboardLayout() {
  const router = useRouter();
  // State quản lý xem màn hình nào đang hiển thị
  const [currentView, setCurrentView] = useState("chat");
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextHasSession = Boolean(getAuthToken());
      setHasSession(nextHasSession);

      if (!nextHasSession) {
        router.replace("/login");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router]);

  if (hasSession !== true) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 text-sm text-slate-500">
        Checking session...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden bg-slate-50">
      {/* Gọi Component Sidebar và truyền prop */}
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

      {/* Hiển thị Component động dựa vào State */}
      <div className="flex-1 flex overflow-hidden">
        {currentView === "chat" && <ChatView />}
        {currentView === "chatbot" && <ChatbotView />}
        {currentView === "history" && <HistoryView />}
        {currentView === "stats" && <StatsView />}
        {currentView === "friends" && <FriendsView />}
        {currentView === "profile" && <ProfileView />}
      </div>
    </div>
  );
}
