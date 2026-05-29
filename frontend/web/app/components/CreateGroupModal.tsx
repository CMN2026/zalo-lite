"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { listFriends, type ProfileUser } from "../lib/users";
import { createConversation } from "../lib/conversations";

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export default function CreateGroupModal({
  open,
  onClose,
  onCreated,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [friends, setFriends] = useState<ProfileUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterQuery, setFilterQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setGroupName("");
    setSelectedIds(new Set());
    setFilterQuery("");
    setError("");
    setLoading(true);

    void loadFriends();
  }, [open]);

  async function loadFriends() {
    try {
      const response = await listFriends();
      setFriends(response.data);
    } catch {
      setError("Không thể tải danh sách bạn bè.");
    } finally {
      setLoading(false);
    }
  }

  const filteredFriends = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return friends;

    return friends.filter(
      (f) =>
        f.fullName.toLowerCase().includes(query) ||
        (f.phone ?? "").includes(query),
    );
  }, [friends, filterQuery]);

  const selectedFriends = useMemo(() => {
    return friends.filter((f) => selectedIds.has(f.id));
  }, [friends, selectedIds]);

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function removeSelected(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }

  async function handleCreate() {
    if (selectedIds.size < 2) {
      setError("Nhóm cần ít nhất 2 thành viên (ngoài bạn).");
      return;
    }
    if (!groupName.trim()) {
      setError("Vui lòng nhập tên nhóm.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const response = await createConversation({
        type: "group",
        name: groupName.trim(),
        memberIds: Array.from(selectedIds),
      });
      onCreated(response.data.id);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "request_failed";
      const labels: Record<string, string> = {
        group_requires_at_least_three_members:
          "Nhóm cần ít nhất 3 thành viên (bao gồm bạn).",
        missing_local_session: "Vui lòng đăng nhập lại.",
        invalid_or_expired_token: "Phiên đăng nhập đã hết hạn.",
      };
      setError(labels[message] ?? "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Tạo nhóm chat
              </h2>
              <p className="text-xs text-slate-500">
                Chọn bạn bè để thêm vào nhóm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Group name */}
        <div className="px-6 pt-4">
          <label className="block mb-1 text-xs font-semibold uppercase text-slate-500">
            Tên nhóm
          </label>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nhập tên nhóm..."
            maxLength={100}
            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 px-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Selected chips */}
        {selectedFriends.length > 0 && (
          <div className="px-6 pt-3 flex flex-wrap gap-2">
            {selectedFriends.map((friend) => (
              <span
                key={friend.id}
                className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium"
              >
                {friend.fullName}
                <button
                  onClick={() => removeSelected(friend.id)}
                  className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <span className="text-xs text-slate-400 self-center">
              ({selectedFriends.length} đã chọn)
            </span>
          </div>
        )}

        {/* Search */}
        <div className="px-6 pt-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Tìm kiếm bạn bè..."
              className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 pl-9 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Friend list */}
        <div className="flex-1 overflow-y-auto mt-3 border-t border-slate-100 min-h-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Đang tải danh sách bạn bè...
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {friends.length === 0
                ? "Bạn chưa có bạn bè nào."
                : "Không tìm thấy bạn bè phù hợp."}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredFriends.map((friend) => {
                const isSelected = selectedIds.has(friend.id);
                const initials = friend.fullName
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <label
                    key={friend.id}
                    className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(friend.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
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
                      <div className="font-semibold text-sm truncate">
                        {friend.fullName}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {friend.phone ?? "Không có SĐT"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-sm text-slate-500">
            {selectedIds.size} thành viên đã chọn
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || selectedIds.size < 2 || !groupName.trim()}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              {creating ? "Đang tạo..." : "Tạo nhóm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
