"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  Smile,
  Loader2,
  Check,
  CheckCheck,
  AlertCircle,
} from "lucide-react";

interface ChatMessage {
  id: string;
  content: string;
  type: "user" | "bot";
  timestamp: Date;
  status?: "sending" | "sent" | "error";
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  unread: number;
  avatar: string;
}

// Mock conversation data
const mockConversations: Conversation[] = [
  {
    id: "1",
    title: "Support Bot",
    lastMessage: "How can I help you today?",
    timestamp: new Date(Date.now() - 3600000),
    unread: 0,
    avatar: "https://via.placeholder.com/40?text=Support",
  },
  {
    id: "2",
    title: "Sales Assistant",
    lastMessage: "Tell me about our products",
    timestamp: new Date(Date.now() - 7200000),
    unread: 2,
    avatar: "https://via.placeholder.com/40?text=Sales",
  },
  {
    id: "3",
    title: "FAQ Bot",
    lastMessage: "What would you like to know?",
    timestamp: new Date(Date.now() - 86400000),
    unread: 0,
    avatar: "https://via.placeholder.com/40?text=FAQ",
  },
];

// Mock messages
const mockMessages: Record<string, ChatMessage[]> = {
  "1": [
    {
      id: "m1",
      content: "Hi! How can I help you today?",
      type: "bot",
      timestamp: new Date(Date.now() - 300000),
      status: "sent",
    },
    {
      id: "m2",
      content: "I have a question about my account",
      type: "user",
      timestamp: new Date(Date.now() - 240000),
      status: "sent",
    },
    {
      id: "m3",
      content:
        "Sure! I'd be happy to help. What's your question about your account?",
      type: "bot",
      timestamp: new Date(Date.now() - 200000),
      status: "sent",
    },
  ],
  "2": [
    {
      id: "m1",
      content: "Welcome! Which product would you like to learn about?",
      type: "bot",
      timestamp: new Date(Date.now() - 7200000),
      status: "sent",
    },
  ],
  "3": [
    {
      id: "m1",
      content: "Hello! What would you like to know?",
      type: "bot",
      timestamp: new Date(Date.now() - 86400000),
      status: "sent",
    },
  ],
};

export default function ChatbotView() {
  const [activeChatId, setActiveChatId] = useState("1");
  const [messages, setMessages] = useState<ChatMessage[]>(
    mockMessages["1"] || [],
  );
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChat =
    mockConversations.find((c) => c.id === activeChatId) ||
    mockConversations[0];

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Switch conversation
  const handleConversationChange = (chatId: string) => {
    setActiveChatId(chatId);
    setMessages(mockMessages[chatId] || []);
    setInputValue("");
  };

  // Send message
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: `m${Date.now()}`,
      content: inputValue,
      type: "user",
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Get token from localStorage
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please log in first");
        setIsLoading(false);
        return;
      }

      // Call actual API
      const response = await fetch("http://localhost:3003/chatbot/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId: activeChatId ? `conv-${activeChatId}` : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const botMessage: ChatMessage = {
        id: `m${Date.now() + 1}`,
        content: data.data.message.content,
        type: "bot",
        timestamp: new Date(),
        status: "sent",
      };

      setMessages((prev) => [
        ...prev.map((m) =>
          m.id === userMessage.id ? { ...m, status: "sent" as const } : m,
        ),
        botMessage,
      ]);
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => [
        ...prev.map((m) =>
          m.id === userMessage.id ? { ...m, status: "error" as const } : m,
        ),
      ]);
      alert("Failed to send message. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return formatTime(date);
    return date.toLocaleDateString();
  };

  return (
    <div className="flex w-full h-full bg-white font-sans text-slate-800">
      {/* Left Sidebar: Conversation List */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-900">AI Chatbots</h1>
          <p className="text-xs text-slate-500 mt-1">Your conversations</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {mockConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => handleConversationChange(conversation.id)}
              className={`p-4 flex gap-3 cursor-pointer border-b border-slate-50 transition-colors ${
                activeChatId === conversation.id
                  ? "bg-blue-50 border-l-4 border-l-blue-600"
                  : "hover:bg-slate-50"
              }`}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={conversation.avatar}
                  alt={conversation.title}
                  className="w-12 h-12 rounded-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-sm font-semibold truncate">
                    {conversation.title}
                  </h3>
                  <span className="text-xs text-slate-400 whitespace-nowrap ml-2">
                    {formatDate(conversation.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {conversation.lastMessage}
                </p>
              </div>
              {conversation.unread > 0 && (
                <div className="flex-shrink-0 bg-blue-600 text-white text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center">
                  {conversation.unread}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {/* Chat Header */}
        <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <img
              src={activeChat.avatar}
              alt={activeChat.title}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {activeChat.title}
              </h2>
              <p className="text-xs text-slate-500">Always online</p>
            </div>
          </div>
          <button className="text-slate-500 hover:text-slate-700 p-2 rounded-lg transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2m0 7a1 1 0 110-2 1 1 0 010 2m0 7a1 1 0 110-2 1 1 0 010 2"
              />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <img
                  src={activeChat.avatar}
                  alt={activeChat.title}
                  className="w-16 h-16 rounded-full object-cover mx-auto mb-4 opacity-50"
                />
                <p className="text-slate-500 text-sm">
                  No messages yet. Start a conversation!
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] ${
                    message.type === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-800 border border-slate-200"
                  } p-4 rounded-2xl ${
                    message.type === "user"
                      ? "rounded-br-none"
                      : "rounded-bl-none"
                  } shadow-sm`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-xs ${message.type === "user" ? "text-blue-100" : "text-slate-400"}`}
                    >
                      {formatTime(message.timestamp)}
                    </span>
                    {message.type === "user" && (
                      <span
                        className={
                          message.status === "sent"
                            ? "text-blue-100"
                            : "text-slate-400"
                        }
                      >
                        {message.status === "sending" && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {message.status === "sent" && (
                          <CheckCheck className="w-3 h-3" />
                        )}
                        {message.status === "error" && (
                          <AlertCircle className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white text-slate-800 border border-slate-200 p-4 rounded-2xl rounded-bl-none shadow-sm">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce animation-delay-100"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce animation-delay-200"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Area */}
        <div className="bg-white border-t border-slate-200 p-4">
          <div className="flex gap-3">
            <button className="text-slate-500 hover:text-slate-700 p-2 rounded-lg transition-colors flex-shrink-0">
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type your message..."
              className="flex-1 bg-slate-100 text-slate-900 placeholder-slate-400 rounded-full py-3 px-4 text-sm outline-none focus:bg-slate-50 focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white p-2 rounded-lg transition-colors flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
            <button className="text-slate-500 hover:text-slate-700 p-2 rounded-lg transition-colors flex-shrink-0">
              <Smile className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
