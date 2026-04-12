"use client";

import React, { useEffect, useState } from "react";
import {
  Crown,
  LogOut,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  getConversation,
  updateConversation,
  deleteConversation,
  leaveConversation,
  addMembersToConversation,
  removeMemberFromConversation,
  type Conversation,
  type ConversationMember,
} from "../lib/conversations";
import { listFriends, type ProfileUser } from "../lib/users";
import { getSavedAuthUser } from "../lib/auth";

interface GroupDetailPanelProps {
  conversationId: string;
  onConversationUpdated: () => void;
  onConversationDeleted: () => void;
}

export default function GroupDetailPanel({
  conversationId,
  onConversationUpdated,
  onConversationDeleted,
}: GroupDetailPanelProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Edit name state
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [friends, setFriends] = useState<ProfileUser[]>([]);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState("");

  const currentUser = getSavedAuthUser();
  const currentUserId = currentUser?.id ?? "";

  const members = conversation?.members ?? [];
  const currentMember = members.find((m) => m.user_id === currentUserId);
  const isOwner = currentMember?.role === "owner";

  useEffect(() => {
    void loadDetail();
  }, [conversationId]);

  async function loadDetail() {
    setLoading(true);
    setError("");
    try {
      const response = await getConversation(conversationId);
      setConversation(response.data);
    } catch {
      setError("Không thể tải thông tin nhóm.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateName() {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await updateConversation(conversationId, { name: newName.trim() });
      setEditingName(false);
      setNotice("Đã cập nhật tên nhóm.");
      void loadDetail();
      onConversationUpdated();
    } catch {
      setError("Không thể cập nhật tên nhóm.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Bạn có chắc muốn giải tán nhóm này? Thao tác này không thể hoàn tác.")) return;
    setBusyAction("delete");
    setError("");
    try {
      await deleteConversation(conversationId);
      onConversationDeleted();
    } catch {
      setError("Không thể giải tán nhóm.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleLeave() {
    if (!window.confirm("Bạn có chắc muốn rời nhóm này?")) return;
    setBusyAction("leave");
    setError("");
    try {
      await leaveConversation(conversationId);
      onConversationDeleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "cannot_leave_group_with_two_or_fewer_members") {
        setError("Không thể rời nhóm khi nhóm có ít hơn 3 thành viên.");
      } else {
        setError("Không thể rời nhóm.");
      }
    } finally {
      setBusyAction("");
    }
  }

  async function handleRemoveMember(userId: string) {
    const member = members.find((m) => m.user_id === userId);
    const name = member?.profile?.full_name ?? "thành viên";
    if (!window.confirm(`Bạn có chắc muốn xóa ${name} khỏi nhóm?`)) return;
    setBusyAction(`remove-${userId}`);
    setError("");
    try {
      await removeMemberFromConversation(conversationId, userId);
      setNotice(`Đã xóa ${name} khỏi nhóm.`);
      void loadDetail();
      onConversationUpdated();
    } catch {
      setError("Không thể xóa thành viên.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleAddMembers() {
    if (addingIds.size === 0) return;
    setBusyAction("add");
    setError("");
    try {
      await addMembersToConversation(conversationId, Array.from(addingIds));
      setNotice(`Đã thêm ${addingIds.size} thành viên.`);
      setAddingIds(new Set());
      setShowAddMember(false);
      void loadDetail();
      onConversationUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "all_users_already_members") {
        setError("Tất cả đã là thành viên nhóm.");
      } else {
        setError("Không thể thêm thành viên.");
      }
    } finally {
      setBusyAction("");
    }
  }

  async function openAddMember() {
    setShowAddMember(true);
    setAddingIds(new Set());
    try {
      const response = await listFriends();
      const memberIds = new Set(members.map((m) => m.user_id));
      setFriends(response.data.filter((f) => !memberIds.has(f.id)));
    } catch {
      setError("Không thể tải danh sách bạn bè.");
    }
  }

  if (loading) {
    return (
      <div className="w-80 border-l border-slate-200 bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Đang tải...</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="w-80 border-l border-slate-200 bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Không tìm thấy nhóm.</p>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-slate-200 bg-white flex flex-col overflow-y-auto">
      {/* Group Header */}
      <div className="flex flex-col items-center py-8 border-b border-slate-100">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-3 shadow-lg">
          <Users className="w-9 h-9 text-white" />
        </div>

        {editingName ? (
          <div className="flex items-center gap-2 px-4 w-full">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={100}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleUpdateName}
              disabled={saving}
              className="text-blue-600 text-sm font-medium hover:underline disabled:opacity-50"
            >
              Lưu
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{conversation.name ?? "Nhóm"}</h2>
            {isOwner && (
              <button
                onClick={() => {
                  setNewName(conversation.name ?? "");
                  setEditingName(true);
                }}
                className="p-1 rounded hover:bg-slate-100 transition-colors"
              >
                <Pencil className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        )}

        <p className="text-sm text-slate-500 mt-1">{members.length} thành viên</p>
      </div>

      {/* Error / Notice */}
      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mx-4 mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {notice}
        </div>
      )}

      {/* Members */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700">Thành viên</h3>
          <button
            onClick={openAddMember}
            className="text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
            title="Thêm thành viên"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Add member mini-panel */}
        {showAddMember && (
          <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600">Thêm bạn bè</span>
              <button onClick={() => setShowAddMember(false)}>
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
            {friends.length === 0 ? (
              <p className="text-xs text-slate-500">Không có bạn bè nào để thêm.</p>
            ) : (
              <>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {friends.map((friend) => (
                    <label key={friend.id} className="flex items-center gap-2 py-1 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={addingIds.has(friend.id)}
                        onChange={() => {
                          setAddingIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(friend.id)) next.delete(friend.id);
                            else next.add(friend.id);
                            return next;
                          });
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                      />
                      <span className="truncate">{friend.fullName}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleAddMembers}
                  disabled={addingIds.size === 0 || busyAction === "add"}
                  className="mt-2 w-full bg-blue-600 text-white text-xs py-1.5 rounded-lg disabled:opacity-50"
                >
                  {busyAction === "add" ? "Đang thêm..." : `Thêm (${addingIds.size})`}
                </button>
              </>
            )}
          </div>
        )}

        <div className="space-y-1">
          {members.map((member) => {
            const name = member.profile?.full_name ?? "Unknown";
            const initials = name
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const isSelf = member.user_id === currentUserId;
            const isOwnerMember = member.role === "owner";

            return (
              <div
                key={member.user_id}
                className="flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {member.profile?.avatar_url ? (
                  <img
                    src={member.profile.avatar_url}
                    alt={name}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {name}
                    {isSelf && (
                      <span className="text-[10px] text-slate-400">(Bạn)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    {isOwnerMember && (
                      <>
                        <Crown className="w-3 h-3 text-amber-500" />
                        <span>Trưởng nhóm</span>
                      </>
                    )}
                    {!isOwnerMember && <span>Thành viên</span>}
                  </div>
                </div>
                {isOwner && !isSelf && (
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    disabled={busyAction === `remove-${member.user_id}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Xóa thành viên"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2">
        <button
          onClick={handleLeave}
          disabled={busyAction === "leave"}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {busyAction === "leave" ? "Đang rời..." : "Rời nhóm"}
        </button>

        {isOwner && (
          <button
            onClick={handleDelete}
            disabled={busyAction === "delete"}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {busyAction === "delete" ? "Đang giải tán..." : "Giải tán nhóm"}
          </button>
        )}
      </div>
    </div>
  );
}
