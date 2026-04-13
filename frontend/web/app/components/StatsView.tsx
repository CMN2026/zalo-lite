import React from "react";

/**
 * StatsView — Thống kê chatbot.
 * Placeholder UI — số liệu thực sẽ được lấy từ /api/chatbot/stats.
 */
export default function StatsView() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8 h-full font-sans text-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Thống kê chatbot</h1>
          <p className="text-slate-500 text-sm mt-1">
            Hiệu suất và chỉ số chất lượng hỗ trợ khách hàng.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">
            Tổng cuộc hội thoại
          </p>
          <h2 className="text-4xl font-bold text-slate-900">—</h2>
          <p className="text-xs text-slate-400 mt-2">Đang tải...</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">
            Đã giải quyết
          </p>
          <h2 className="text-4xl font-bold text-slate-900">—</h2>
          <p className="text-xs text-slate-400 mt-2">Đang tải...</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">
            Cần nhân viên
          </p>
          <h2 className="text-4xl font-bold text-slate-900">—</h2>
          <p className="text-xs text-slate-400 mt-2">Đang tải...</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">
            Pattern đã học
          </p>
          <h2 className="text-4xl font-bold text-slate-900">—</h2>
          <p className="text-xs text-slate-400 mt-2">Đang tải...</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-12 h-12 text-slate-300 mx-auto mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
        <h3 className="font-semibold text-slate-700 mb-2">
          Tính năng đang phát triển
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Dashboard thống kê chi tiết sẽ được tích hợp từ endpoint{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">
            GET /api/chatbot/stats
          </code>{" "}
          trong phiên bản tiếp theo.
        </p>
      </div>
    </div>
  );
}