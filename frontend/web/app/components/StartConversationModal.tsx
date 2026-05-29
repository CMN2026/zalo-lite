"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { listFriends, type ProfileUser } from "../lib/users";

type StartConversationModalProps = {
  open: boolean;
  onClose: () => void;
  onSelectFriend: (friend: ProfileUser) => void | Promise<void>;
};

export default function StartConversationModal({
  open,
  onClose,
  onSelectFriend,
}: StartConversationModalProps) {
  const [friends, setFriends] = useState<ProfileUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setError("");
    setLoading(true);
    setSelectingId(null);

    void (async () => {
      try {
        const response = await listFriends();
        setFriends(response.data ?? []);
      } catch {
        setFriends([]);
        setError("Khong the tai danh sach ban be.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const filteredFriends = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return friends;
    }

    return friends.filter((friend) => {
      const byName = friend.fullName.toLowerCase().includes(normalized);
      const byPhone = (friend.phone ?? "").toLowerCase().includes(normalized);
      const byEmail = (friend.email ?? "").toLowerCase().includes(normalized);
      return byName || byPhone || byEmail;
    });
  }, [friends, query]);

  async function handleSelect(friend: ProfileUser) {
    setError("");
    setSelectingId(friend.id);

    try {
      await onSelectFriend(friend);
      onClose();
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "request_failed";
      const labels: Record<string, string> = {
        direct_conversation_requires_friendship:
          "Chi co the tao chat 1:1 voi ban be da ket ban.",
        missing_local_session: "Vui long dang nhap lai.",
        invalid_or_expired_token: "Phien dang nhap da het han.",
      };

      setError(labels[message] ?? "Khong the mo cuoc tro chuyen moi.");
    } finally {
      setSelectingId(null);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Plus className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Mo cuoc tro chuyen moi
              </h2>
              <p className="text-xs text-slate-500">Chon mot nguoi ban</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Dong"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tim ten, so dien thoai, email"
              className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 pl-9 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-3 border-t border-slate-100 flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Dang tai danh sach ban be...
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              {friends.length === 0
                ? "Ban chua co ban be nao."
                : "Khong tim thay nguoi phu hop."}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredFriends.map((friend) => {
                const initials = friend.fullName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const selecting = selectingId === friend.id;

                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => void handleSelect(friend)}
                    disabled={Boolean(selectingId)}
                    className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-slate-50 disabled:opacity-60"
                  >
                    {friend.avatarUrl ? (
                      <img
                        src={friend.avatarUrl}
                        alt={friend.fullName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                        {initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {friend.fullName}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {friend.phone ?? friend.email ?? "Khong co thong tin"}
                      </p>
                    </div>
                    <span className="text-xs text-blue-600 font-semibold">
                      {selecting ? "Dang mo..." : "Mo"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
