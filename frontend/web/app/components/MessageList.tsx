"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Check, CheckCheck, Download } from "lucide-react";
import { getAuthToken } from "../lib/auth";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: "text" | "file";
  content: string;
  created_at: string;
  read_by: string[];
  deleted_at?: string;
  file_url?: string;
  file_name?: string;
}

type ParsedFilePayload = {
  text?: string;
  file?: {
    filename?: string;
    originalName?: string;
    mimetype?: string;
    size?: number;
    path?: string;
  };
  file_name?: string;
  file_size?: number;
  file_type?: string;
};

const rawChatServiceUrl = process.env.NEXT_PUBLIC_CHAT_SERVICE_URL;
const CHAT_SERVICE_URL =
  rawChatServiceUrl && /^https?:\/\//i.test(rawChatServiceUrl)
    ? rawChatServiceUrl
    : "http://localhost:3002";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  conversationName: string;
  onLoadMore?: () => void;
  isLoading?: boolean;
  isAdminView?: boolean;
  showSenderAvatar?: boolean;
}

export default function MessageList({
  messages,
  currentUserId,
  conversationName,
  onLoadMore,
  isLoading = false,
  isAdminView = false,
  showSenderAvatar = true,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const displayMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((msg) => {
      if (msg.deleted_at) {
        return false;
      }

      if (seen.has(msg.id)) {
        return false;
      }

      seen.add(msg.id);
      return true;
    });
  }, [messages]);
  const authToken = getAuthToken();
  const [previewImage, setPreviewImage] = React.useState<{
    url: string;
    name: string;
  } | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  };

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN");
    } catch {
      return "";
    }
  };

  const getReadStatus = (message: Message) => {
    const readCount = message.read_by?.length || 0;
    if (readCount === 0) return "sent";
    if (readCount === 1) return "delivered";
    return "read";
  };

  const isMessageFromCurrentUser = (senderId: string) =>
    senderId === currentUserId;

  const parseFilePayload = (content: string): ParsedFilePayload => {
    try {
      return JSON.parse(content) as ParsedFilePayload;
    } catch {
      return {
        file_name: "attachment",
      };
    }
  };

  return (
    <div
      className={`flex-1 overflow-y-auto p-6 flex flex-col gap-4 ${
        isAdminView ? "bg-[#dde1e7]" : "bg-linear-to-b from-slate-50 to-white"
      }`}
    >
      {displayMessages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-center">
            Bắt đầu cuộc trò chuyện với <strong>{conversationName}</strong>
          </p>
        </div>
      ) : (
        <>
          {displayMessages.map((message, index) => {
            const messageDate = formatDate(message.created_at);
            const previousMessageDate =
              index > 0
                ? formatDate(displayMessages[index - 1]?.created_at ?? "")
                : "";
            const showDateSeparator = messageDate !== previousMessageDate;

            const isOwn = isMessageFromCurrentUser(message.sender_id);
            const readStatus = getReadStatus(message);

            if (message.type === "text") {
              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center my-4">
                      <p className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                        {messageDate}
                      </p>
                    </div>
                  )}

                  <div
                    className={`flex ${
                      isOwn ? "justify-end" : "justify-start"
                    } gap-3 animate-fadeIn`}
                  >
                    {!isOwn && showSenderAvatar && (
                      <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                        {conversationName.charAt(0)}
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${
                        isOwn ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`px-4 py-2 rounded-2xl max-w-xs wrap-break-word shadow-sm transition-all ${
                          isOwn
                            ? "bg-blue-600 text-white rounded-br-md"
                            : isAdminView
                              ? "bg-white text-slate-800 border border-slate-200"
                              : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>

                      <div
                        className={`flex items-center gap-1 text-xs mt-1 ${
                          isOwn ? "text-slate-400" : "text-slate-400"
                        }`}
                      >
                        <span>{formatTime(message.created_at)}</span>
                        {isOwn && (
                          <>
                            {readStatus === "sent" && (
                              <Check className="w-3 h-3" />
                            )}
                            {readStatus === "delivered" && (
                              <CheckCheck className="w-3 h-3" />
                            )}
                            {readStatus === "read" && (
                              <CheckCheck className="w-3 h-3 text-blue-400" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // File message
            if (message.type === "file") {
              const filePayload = parseFilePayload(message.content);
              const embeddedFile = filePayload.file;
              const fileName =
                embeddedFile?.originalName ||
                filePayload.file_name ||
                embeddedFile?.filename ||
                "attachment";
              const fileSize = embeddedFile?.size || filePayload.file_size || 0;
              const fileType =
                embeddedFile?.mimetype || filePayload.file_type || "";
              const filePath = embeddedFile?.path;
              const previewUrl =
                filePath && authToken
                  ? `${CHAT_SERVICE_URL}${filePath}?token=${encodeURIComponent(authToken)}`
                  : undefined;
              const downloadUrl =
                previewUrl && fileName
                  ? `${previewUrl}&download=1&name=${encodeURIComponent(fileName)}`
                  : undefined;
              const isImage =
                fileType.startsWith("image/") && Boolean(previewUrl);

              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center my-4">
                      <p className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                        {messageDate}
                      </p>
                    </div>
                  )}

                  <div
                    className={`flex ${
                      isOwn ? "justify-end" : "justify-start"
                    } gap-3 animate-fadeIn`}
                  >
                    {!isOwn && showSenderAvatar && (
                      <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                        {conversationName.charAt(0)}
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${
                        isOwn ? "items-end" : "items-start"
                      }`}
                    >
                      {isImage && previewUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewImage({
                              url: previewUrl,
                              name: fileName,
                            });
                          }}
                          className="mb-1"
                        >
                          <img
                            src={previewUrl}
                            alt={fileName}
                            className="max-w-xs rounded-xl border border-slate-200"
                          />
                        </button>
                      )}

                      {(!isImage || !previewUrl) && (
                        <div
                          className={`px-4 py-3 rounded-2xl shadow-sm border transition-all ${
                            isOwn
                              ? "bg-blue-600 border-blue-600 rounded-br-md"
                              : isAdminView
                                ? "bg-white border-slate-200 hover:bg-slate-50"
                                : "bg-white border-slate-200 rounded-bl-none hover:bg-slate-50"
                          } cursor-pointer group`}
                        >
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3"
                          >
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                isOwn ? "bg-blue-500" : "bg-slate-100"
                              }`}
                            >
                              <Download
                                className={`w-5 h-5 ${
                                  isOwn ? "text-white" : "text-slate-600"
                                }`}
                              />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <p
                                className={`text-xs font-semibold truncate ${
                                  isOwn ? "text-white" : "text-slate-800"
                                }`}
                              >
                                {fileName}
                              </p>
                              <p
                                className={`text-xs ${
                                  isOwn ? "text-blue-100" : "text-slate-500"
                                }`}
                              >
                                {(fileSize / 1024).toFixed(2)} KB
                              </p>
                            </div>
                          </a>
                        </div>
                      )}

                      <div
                        className={`flex items-center gap-1 text-xs mt-1 ${
                          isOwn ? "text-slate-400" : "text-slate-400"
                        }`}
                      >
                        <span>{formatTime(message.created_at)}</span>
                        {isOwn && (
                          <>
                            {readStatus === "sent" && (
                              <Check className="w-3 h-3" />
                            )}
                            {readStatus === "delivered" && (
                              <CheckCheck className="w-3 h-3" />
                            )}
                            {readStatus === "read" && (
                              <CheckCheck className="w-3 h-3 text-blue-400" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })}
          <div ref={messagesEndRef} />
        </>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {previewImage.name}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={`${previewImage.url}&download=1&name=${encodeURIComponent(previewImage.name)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-56px)] flex items-center justify-center bg-slate-50">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-w-full max-h-[75vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
