"use client";

import React, { useState } from "react";
import Sidebar from "../app/components/Sidebar";
import ChatView from "../app/components/ChatView";
import ChatbotView from "../app/components/ChatbotView";
import HistoryView from "../app/components/HistoryView";
import StatsView from "../app/components/StatsView";

export default function DashboardLayout() {
  // State quản lý xem màn hình nào đang hiển thị
  const [currentView, setCurrentView] = useState("chat");

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
      </div>
    </div>
  );
}
