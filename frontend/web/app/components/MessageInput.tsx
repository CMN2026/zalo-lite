"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Smile, X, Loader } from "lucide-react";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onSendFile: (file: File, caption?: string) => void;
  isLoading?: boolean;
  isConnected?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
  isAdminView?: boolean;
  replyToMessagePreview?: string;
  onCancelReply?: () => void;
}

export default function MessageInput({
  onSendMessage,
  onSendFile,
  isLoading = false,
  isConnected = true,
  disabled = false,
  disabledMessage,
  isAdminView = false,
  replyToMessagePreview,
  onCancelReply,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const safeMessage = typeof message === "string" ? message : "";
  const emojiList = [
    "😀",
    "😁",
    "😂",
    "🤣",
    "😊",
    "😍",
    "😘",
    "😎",
    "🤗",
    "🤔",
    "😢",
    "😭",
    "😡",
    "👍",
    "👏",
    "🙏",
    "🔥",
    "❤️",
    "🎉",
    "✨",
    "💯",
    "💪",
    "👌",
    "🤝",
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendMessage = () => {
    if (safeMessage.trim() && !isLoading && !disabled) {
      onSendMessage(safeMessage.trim());
      setMessage("");
      setShowEmojiPicker(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        alert("File quá lớn! Tối đa 50MB");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      // Check file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/x-msvideo",
        "video/x-matroska",
        "video/3gpp",
        "video/3gpp2",
        "video/mpeg",
        "video/x-ms-wmv",
        "video/ogg",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "application/zip",
      ];

      if (!allowedTypes.includes(file.type)) {
        alert("Loại file không hỗ trợ");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleSendFile = async () => {
    if (selectedFile && !isUploading && !disabled) {
      setIsUploading(true);
      try {
        onSendFile(selectedFile, safeMessage.trim() || undefined);
        clearSelectedFile();
        setMessage("");
        setShowEmojiPicker(false);
      } catch (error) {
        console.error("Error sending file:", error);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    setMessage((prev) => `${prev}${emoji}`);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return "🖼️";
    }
    if (file.type.startsWith("video/")) {
      return "🎬";
    }
    if (file.type === "application/pdf") {
      return "📄";
    }
    if (file.type.includes("word") || file.type.includes("document")) {
      return "📝";
    }
    if (file.type.includes("sheet") || file.type.includes("excel")) {
      return "📊";
    }
    return "📎";
  };

  return (
    <div
      className={`p-4 border-t border-slate-200 relative ${
        isAdminView ? "bg-[#dde1e7]" : "bg-white"
      }`}
      ref={emojiPickerRef}
    >
      {disabled && (
        <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {disabledMessage ?? "Bạn không thể nhắn trong cuộc trò chuyện này."}
        </div>
      )}

      {replyToMessagePreview && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-blue-700">Đang trả lời</p>
            <p className="truncate text-xs text-blue-600">
              {replyToMessagePreview}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-md p-1 text-blue-600 hover:bg-blue-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 mb-2 w-72 max-w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-20">
          <div className="grid grid-cols-8 gap-1">
            {emojiList.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleInsertEmoji(emoji)}
                className="h-8 w-8 rounded-md text-lg hover:bg-slate-100 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedFile ? (
        <div className="space-y-3">
          {/* File preview */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-2xl">{getFileIcon(selectedFile)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-slate-500">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <button
              onClick={clearSelectedFile}
              className="p-1 hover:bg-slate-200 rounded"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Optional caption */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            <input
              key="caption-input"
              type="text"
              value={safeMessage}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Thêm chú thích (tùy chọn)..."
              className="w-full text-sm bg-transparent outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={clearSelectedFile}
              className="px-4 py-2 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSendFile}
              disabled={isUploading || !isConnected || disabled}
              className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Gửi tệp
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`flex items-end gap-3 border border-slate-200 px-3 py-2 transition-all focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 ${
            isAdminView ? "bg-[#eef1f6] rounded-xl" : "bg-slate-50 rounded-lg"
          }`}
        >
          {/* File attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected || disabled}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors"
            title="Đính kèm file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Emoji button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Message input */}
          <input
            key="message-input"
            type="text"
            value={safeMessage}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Nhập tin nhắn..." : "Đang kết nối..."}
            disabled={!isConnected || disabled}
            className="flex-1 bg-transparent outline-none text-sm px-2 disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Send button */}
          <button
            onClick={handleSendMessage}
            disabled={
              !safeMessage.trim() || isLoading || !isConnected || disabled
            }
            className={`transition-colors ${
              isAdminView
                ? "w-9 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-100 flex items-center justify-center"
                : "text-blue-600 hover:text-blue-700 disabled:text-slate-300"
            }`}
            title="Gửi"
          >
            {isLoading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        key="hidden-file-input"
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        disabled={disabled}
        className="hidden"
        accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm,.avi,.mkv,.3gp,.3g2,.mpeg,.mpg,.wmv,.ogv,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
      />
    </div>
  );
}
