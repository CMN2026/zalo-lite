"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  Search,
  Paperclip,
  Smile,
  Send,
  ChevronDown,
  Bot,
  FileText,
} from "lucide-react";
import { mockConversations } from "../lib/mockData";

export default function ChatView() {
  const [activeChatId, setActiveChatId] = useState(1);
  const [messageInput, setMessageInput] = useState("");
  const [conversations, setConversations] = useState(mockConversations);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChat =
    conversations.find((c) => c.id === activeChatId) || conversations[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages]);

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

      // Send message to chatbot API
      const response = await fetch("http://localhost:3003/chatbot/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId: activeChat?.conversationId || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const botMessage = data.data.message;
      const conversationId = data.data.conversationId;

      // Update conversations with both user and bot messages
      setConversations((prevConvs) =>
        prevConvs.map((conv) => {
          if (conv.id === activeChatId) {
            return {
              ...conv,
              conversationId,
              messages: [
                ...conv.messages,
                {
                  id: Date.now(),
                  sender: "user" as const,
                  text: userMessage,
                  time: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
                {
                  id: Date.now() + 1,
                  sender: "ai" as const,
                  text: botMessage.content,
                  time: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
              ],
            };
          }
          return conv;
        }),
      );
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
          <h1 className="text-xl font-semibold">OTT Care</h1>
          <Bell className="w-5 h-5 text-slate-500 cursor-pointer" />
        </div>
        <div className="p-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full bg-slate-100 text-sm rounded-full py-2 pl-9 pr-4 outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {mockConversations.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={`p-4 flex gap-3 cursor-pointer border-b border-slate-50 transition-colors ${activeChatId === chat.id ? "bg-slate-50" : "hover:bg-slate-50"}`}
            >
              <div className="relative">
                <img
                  src={chat.avatar}
                  alt={chat.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                {chat.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-sm font-semibold truncate">
                    {chat.name}
                  </h3>
                  <span className="text-xs text-slate-400 whitespace-nowrap ml-2">
                    {chat.time}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {chat.preview}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cột Giữa: Khung Chat */}
      <div className="flex-1 flex flex-col bg-slate-50 relative">
        <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <img
              src={activeChat.avatar}
              alt={activeChat.name}
              className="w-9 h-9 rounded-full object-cover"
            />
            <div>
              <h2 className="text-sm font-semibold">{activeChat.name}</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  className={`w-2 h-2 rounded-full ${activeChat.online ? "bg-green-500" : "bg-slate-300"}`}
                ></span>
                {activeChat.online ? "Online" : "Offline"}
              </div>
            </div>
          </div>
          <button className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-full">
            Resolve
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {activeChat.messages.map((msg) => {
            if (msg.sender === "user") {
              return (
                <div
                  key={msg.id}
                  className="flex flex-col items-start max-w-[70%]"
                >
                  <div className="bg-white border border-slate-200 text-slate-800 p-4 rounded-2xl rounded-tl-sm shadow-sm text-sm">
                    {msg.text}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 ml-1">
                    {msg.time}
                  </span>
                </div>
              );
            }
            if (msg.sender === "ai") {
              return (
                <div
                  key={msg.id}
                  className="flex gap-3 max-w-[80%] items-start"
                >
                  <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="bg-white border border-slate-200 text-slate-800 p-4 rounded-2xl rounded-tl-sm shadow-sm text-sm leading-relaxed">
                      {msg.text}
                      <div className="text-[11px] font-semibold text-blue-600 mt-3">
                        AI Assistant • {msg.time}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            if (msg.sender === "agent") {
              return (
                <div
                  key={msg.id}
                  className="flex flex-col items-end self-end max-w-[70%]"
                >
                  <div className="bg-blue-600 text-white p-4 rounded-2xl rounded-tr-sm shadow-sm text-sm">
                    {msg.text}
                    <div className="text-[11px] text-blue-200 mt-2 text-right">
                      Agent • {msg.time}
                    </div>
                  </div>
                </div>
              );
            }
          })}
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
              placeholder="Type your message..."
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

      {/* Cột Phải: Thông tin chi tiết */}
      <div className="w-80 border-l border-slate-200 bg-white flex flex-col overflow-y-auto">
        <div className="flex flex-col items-center py-8 border-b border-slate-100">
          <img
            src={activeChat.avatar}
            alt={activeChat.name}
            className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm mb-3"
          />
          <h2 className="text-lg font-bold">{activeChat.name}</h2>
          <p className="text-sm text-slate-500 mt-1">{activeChat.email}</p>
          <p className="text-sm text-slate-500">{activeChat.phone}</p>
        </div>
        <div className="p-6 border-b border-slate-100 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subject:</span>
            <span className="font-medium text-right">{activeChat.subject}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Category:</span>
            <span className="font-medium text-right">
              {activeChat.category}
            </span>
          </div>
        </div>
        {/* Placeholder cho Previous Tickets & Shared Files để gọn code */}
      </div>
    </div>
  );
}
