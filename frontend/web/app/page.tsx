"use client";

<<<<<<< HEAD
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./contexts/auth";
=======
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
>>>>>>> 41cff5b2fcba6bd3c43fc945ec8ea6a0e6253ec0
import Sidebar from "../app/components/Sidebar";
import ChatView from "../app/components/ChatView";
import FriendsView from "../app/components/FriendsView";
import HistoryView from "../app/components/HistoryView";
import ProfileView from "../app/components/ProfileView";
import StatsView from "../app/components/StatsView";
import { getAuthToken } from "../app/lib/auth";

export default function DashboardLayout() {
  const router = useRouter();
<<<<<<< HEAD
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState("chat");
  const [unreadCount, setUnreadCount] = useState(0);

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
=======
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
>>>>>>> 41cff5b2fcba6bd3c43fc945ec8ea6a0e6253ec0

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
<<<<<<< HEAD
        {currentView === "chat" && (
          <ChatView onUnreadCountChange={setUnreadCount} />
        )}
        {currentView === "history" && <HistoryView />}
        {currentView === "stats" && <StatsView />}
=======
        {currentView === 'chat' && <ChatView />}
        {currentView === 'history' && <HistoryView />}
        {currentView === 'stats' && <StatsView />}
        {currentView === 'friends' && <FriendsView />}
        {currentView === 'profile' && <ProfileView />}
>>>>>>> 41cff5b2fcba6bd3c43fc945ec8ea6a0e6253ec0
      </div>
    </div>
  );
}
