"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./contexts/auth";

import Sidebar from "../app/components/Sidebar";
import ChatView from "../app/components/ChatView";
import ChatbotView from "../app/components/ChatbotView";
import FriendsView from "../app/components/FriendsView";
import HistoryView from "../app/components/HistoryView";
import ProfileView from "../app/components/ProfileView";
import StatsView from "../app/components/StatsView";

export default function DashboardLayout() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState("chat");
  const [unreadCount] = useState(0);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Zalo Lite</h1>
          <p className="text-slate-500 mt-2">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden bg-slate-50">
      {/* Gọi Component Sidebar và truyền prop */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        unreadCount={unreadCount}
      />

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
