import React from "react";
import { MessageSquare, FileText, BarChart2, Settings } from "lucide-react";

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

      <div className="flex-grow"></div>
      <Settings className="w-6 h-6 hover:text-white cursor-pointer transition-colors" />
    </div>
  );
}
