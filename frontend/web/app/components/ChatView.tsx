"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { Bell, Search, Paperclip, Smile, Send, Users } from "lucide-react";
import { listConversations, type Conversation } from "../lib/conversations";
import CreateGroupModal from "./CreateGroupModal";
import GroupDetailPanel from "./GroupDetailPanel";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3004";

type ActiveChat = { source: "real"; id: string };

export default function ChatView() {
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [realConversations, setRealConversations] = useState<Conversation[]>(
    [],
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeReal = activeChat
    ? (realConversations.find((c) => c.id === activeChat.id) ?? null)
    : null;

  const groupConversations = realConversations.filter(
    (c) => c.type === "group",
  );

  const loadConversations = useCallback(async () => {
    try {
      const response = await listConversations();
      setRealConversations(response.data);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  function handleGroupCreated(_conversationId: string) {
    void loadConversations();
  }

  function handleConversationUpdated() {
    void loadConversations();
  }

  function handleConversationDeleted() {
    setActiveChat(null);
    void loadConversations();
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const userMessage = messageInput;
    setMessageInput("");
    setLoading(true);

    try {
      // Get token from localStorage
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please log in first");
        setLoading(false);
        return;
      }

      // Send message via API Gateway
      const response = await fetch(`${API_BASE_URL}/api/chatbot/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId: activeReal?.id || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Reload conversations to reflect new messages
      void loadConversations();
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Check console for details.");
      setMessageInput(userMessage); // Restore message on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full h-full bg-white font-sans text-slate-800">
      {/* Cột Trái: Danh sách */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 flex items-center justify-between border-b border-slate-100">
          <h1 className="text-xl font-semibold">Tin nhắn</h1>
          <Bell className="w-5 h-5 text-slate-500 cursor-pointer" />
        </div>
        <div className="p-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              className="w-full bg-slate-100 text-sm rounded-full py-2 pl-9 pr-4 outline-none"
            />
          </div>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
            title="Tạo nhóm chat"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Group conversations from API */}
          {groupConversations.length > 0 && (
            <>
              <div className="px-4 py-2">
                <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Nhóm chat
                </span>
              </div>
              {groupConversations.map((conv) => {
                const isActive = activeChat?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() =>
                      setActiveChat({ source: "real", id: conv.id })
                    }
                    className={`w-full p-4 flex gap-3 cursor-pointer border-b border-slate-50 transition-colors text-left ${
                      isActive ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="text-sm font-semibold truncate">
                          {conv.name ?? "Nhóm"}
                        </h3>
                        <span className="text-xs text-slate-400 whitespace-nowrap ml-2">
                          {conv.last_message_at
                            ? new Date(conv.last_message_at).toLocaleTimeString(
                                "vi-VN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : ""}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        Nhóm chat
                      </p>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Middle Column: Real conversation view */}
      {activeReal ? (
        <div className="flex-1 flex flex-col bg-slate-50 relative">
          <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">
                  {activeReal.name ?? "Nhóm"}
                </h2>
                <p className="text-xs text-slate-500">Cuộc trò chuyện</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              {activeReal.name ?? "Nhóm"}
            </h3>
            <p className="text-sm text-slate-500">Bắt đầu cuộc trò chuyện!</p>
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-slate-200">
            <form
              onSubmit={sendMessage}
              className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full px-4 py-2"
            >
              <Paperclip className="w-5 h-5 text-slate-400 cursor-pointer" />
              <Smile className="w-5 h-5 text-slate-400 cursor-pointer" />
              <input
                type="text"
                placeholder="Nhập tin nhắn..."
                className="flex-1 bg-transparent outline-none text-sm px-2"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                className="bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Bell className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            Chọn cuộc trò chuyện
          </h3>
          <p className="text-sm text-slate-500 mt-2">
            Chọn cuộc trò chuyện từ danh sách bên trái
          </p>
        </div>
      )}

      {/* Right Column: Detail Panel */}
      {activeReal && (
        <GroupDetailPanel
          conversationId={activeReal.id}
          onConversationUpdated={handleConversationUpdated}
          onConversationDeleted={handleConversationDeleted}
        />
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={handleGroupCreated}
      />
    </div>
  );
}
