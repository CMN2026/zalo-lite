import React from "react";

/**
 * HistoryView — Lịch sử hỗ trợ chatbot.
 * Hiển thị hướng dẫn cho người dùng xem lại các cuộc trò chuyện từ tab Chatbot.
 */
export default function HistoryView() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8 h-full font-sans text-slate-800">
      <div className="max-w-2xl mx-auto pt-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Lịch sử hỗ trợ
        </h1>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Tất cả các cuộc trò chuyện với chatbot hỗ trợ được lưu trữ và có thể
          xem lại trong tab <strong>Hỗ trợ</strong>. Chọn một cuộc trò chuyện
          từ danh sách bên trái để xem lại nội dung.
        </p>

        <div className="grid grid-cols-1 gap-4 text-left">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-1">
              Xem lại cuộc trò chuyện
            </h3>
            <p className="text-sm text-slate-500">
              Chuyển sang tab <strong>Hỗ trợ</strong> → chọn cuộc trò chuyện
              trong danh sách bên trái.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-1">
              Đóng cuộc trò chuyện
            </h3>
            <p className="text-sm text-slate-500">
              Khi vấn đề đã được giải quyết, nhấn <strong>Đóng hội thoại</strong>{" "}
              để đánh dấu trạng thái "Đã xử lý".
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-1">
              Liên hệ nhân viên
            </h3>
            <p className="text-sm text-slate-500">
              Chatbot sẽ tự động chuyển đến nhân viên khi phát hiện vấn đề phức
              tạp cần can thiệp thủ công.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}