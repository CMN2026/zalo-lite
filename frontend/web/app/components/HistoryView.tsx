"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getCallHistory, type CallHistoryItem } from "../lib/calls";

type StatusMeta = {
  label: string;
  className: string;
};

const STATUS_META: Record<CallHistoryItem["status"], StatusMeta> = {
  answered: {
    label: "Đã nghe",
    className: "bg-emerald-100 text-emerald-700",
  },
  declined: {
    label: "Từ chối",
    className: "bg-amber-100 text-amber-700",
  },
  missed: {
    label: "Nhỡ",
    className: "bg-rose-100 text-rose-700",
  },
};

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "0s";
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

export default function HistoryView() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<CallHistoryItem[]>([]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await getCallHistory(200);
      const data = Array.isArray(response.data) ? response.data : [];
      setItems(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "request_failed";
      setErrorMessage(`Không thể tải lịch sử cuộc gọi: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const stats = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] += 1;
        return acc;
      },
      {
        total: 0,
        answered: 0,
        declined: 0,
        missed: 0,
      },
    );
  }, [items]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafbfc] px-10 py-8 h-full font-sans text-slate-800">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
              Lịch sử cuộc gọi
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi trạng thái cuộc gọi 1-1 và nhóm: đã nghe, từ chối, nhỡ.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadHistory();
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Làm mới
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Tổng cuộc gọi
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Đã nghe
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-800">
              {stats.answered}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Từ chối
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-800">
              {stats.declined}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-rose-700">
              Nhỡ
            </p>
            <p className="mt-2 text-2xl font-semibold text-rose-800">
              {stats.missed}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Đang tải lịch sử cuộc gọi...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Chưa có lịch sử cuộc gọi nào.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <div className="col-span-3">Bắt đầu</div>
              <div className="col-span-2">Loại</div>
              <div className="col-span-3">Hội thoại</div>
              <div className="col-span-2">Thời lượng</div>
              <div className="col-span-2">Trạng thái</div>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const status = STATUS_META[item.status];
                return (
                  <div
                    key={item.created_at_call_id}
                    className="grid grid-cols-12 gap-3 px-4 py-3 text-sm text-slate-700"
                  >
                    <div className="col-span-3">
                      <p>{formatDateTime(item.started_at)}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Kết thúc: {formatDateTime(item.ended_at)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      {item.call_type === "group" ? "Nhóm" : "1-1"}
                    </div>
                    <div className="col-span-3">
                      <p className="truncate font-medium" title={item.conversation_id}>
                        {item.conversation_id}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Call ID: {item.call_id}
                      </p>
                    </div>
                    <div className="col-span-2">{formatDuration(item.duration_seconds)}</div>
                    <div className="col-span-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}