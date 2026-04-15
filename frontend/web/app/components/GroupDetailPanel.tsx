"use client";
/* eslint-disable @next/next/no-img-element */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bell,
  BellOff,
  Crown,
  Image as ImageIcon,
  Link2,
  LogOut,
  Pencil,
  ShieldBan,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  addMembersToConversation,
  deleteConversation,
  getConversation,
  leaveConversation,
  removeMemberFromConversation,
  type Conversation,
  type ConversationMember,
  updateConversation,
} from "../lib/conversations";
import {
  blockFriendship,
  getFriendshipStatus,
  listFriends,
  type ProfileUser,
  unblockFriendship,
} from "../lib/users";
import { getAuthToken, getSavedAuthUser } from "../lib/auth";
import type { Message } from "./MessageList";

type BlockState = {
  isBlocked: boolean;
  blockedByCurrentUser: boolean;
};

interface GroupDetailPanelProps {
  readonly conversationId: string;
  readonly conversationType: "direct" | "group";
  readonly messages: Message[];
  readonly userLookup?: Record<
    string,
    {
      fullName: string;
      email?: string;
      phone?: string;
      avatarUrl?: string | null;
    }
  >;
  readonly isMuted: boolean;
  readonly onToggleMute: (muted: boolean) => void;
  readonly onBlockStateChange?: (state: BlockState) => void;
  readonly onConversationUpdated: () => void;
  readonly onConversationDeleted: () => void;
}

type ParsedFilePayload = {
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3004";
const FRIENDSHIP_STATUS_UNSUPPORTED_KEY =
  "zalo-lite:web:friendship-status-unsupported";

function parseFilePayload(content: string): ParsedFilePayload {
  try {
    return JSON.parse(content) as ParsedFilePayload;
  } catch {
    return {
      file_name: "tệp đính kèm",
      file_size: 0,
      file_type: "",
    };
  }
}

function buildUploadBasePath(filePath: string) {
  const suffix = filePath.replace(/^\/uploads/, "");
  return `${API_BASE_URL}/api/uploads${suffix}`;
}

function isImageByType(fileType?: string, fileName?: string) {
  if (fileType?.startsWith("image/")) {
    return true;
  }

  const lower = (fileName ?? "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].some((ext) =>
    lower.endsWith(ext),
  );
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function resolveDirectPeerId(member: ConversationMember | null): string | null {
  if (!member) {
    return null;
  }

  const profileId =
    typeof member.profile?.id === "string" ? member.profile.id.trim() : "";
  const memberUserId =
    typeof member.userId === "string" ? member.userId.trim() : "";

  if (profileId && isUuidLike(profileId)) {
    return profileId;
  }

  if (memberUserId && isUuidLike(memberUserId)) {
    return memberUserId;
  }

  return profileId || memberUserId || null;
}

export default function GroupDetailPanel({
  conversationId,
  conversationType,
  messages,
  userLookup,
  isMuted,
  onToggleMute,
  onBlockStateChange,
  onConversationUpdated,
  onConversationDeleted,
}: Readonly<GroupDetailPanelProps>) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const [showAddMember, setShowAddMember] = useState(false);
  const [friends, setFriends] = useState<ProfileUser[]>([]);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState("");

  const [directPeerId, setDirectPeerId] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByCurrentUser, setBlockedByCurrentUser] = useState(false);
  const friendshipStatusEndpointUnavailableRef = useRef(
    typeof window !== "undefined" &&
      window.localStorage.getItem(FRIENDSHIP_STATUS_UNSUPPORTED_KEY) === "1",
  );
  const friendshipStatusFetchRef = useRef<{
    peerId: string | null;
    inFlight: boolean;
    lastFetchedAt: number;
  }>({
    peerId: null,
    inFlight: false,
    lastFetchedAt: 0,
  });

  const currentUser = getSavedAuthUser();
  const currentUserId = currentUser?.id ?? "";
  const authToken = getAuthToken();

  const members = useMemo(() => conversation?.members ?? [], [conversation]);
  const currentMember = members.find((m) => m.userId === currentUserId);
  const isOwner = currentMember?.role === "owner";

  const directPeer = useMemo(() => {
    if (conversationType !== "direct") {
      return null;
    }

    return members.find((member) => member.userId !== currentUserId) ?? null;
  }, [conversationType, currentUserId, members]);

  const sharedMedia = useMemo(() => {
    return messages
      .filter((message) => message.type === "file")
      .map((message) => {
        const payload = parseFilePayload(message.content);
        const embeddedFile = payload.file;
        const fileName =
          embeddedFile?.originalName ||
          payload.file_name ||
          embeddedFile?.filename ||
          "tệp đính kèm";
        const fileType = embeddedFile?.mimetype || payload.file_type || "";
        const fileSize = embeddedFile?.size || payload.file_size || 0;
        const filePath = embeddedFile?.path;

        const previewUrl =
          filePath && authToken
            ? `${buildUploadBasePath(filePath)}?token=${encodeURIComponent(authToken)}`
            : undefined;

        const item = {
          id: message.id,
          fileName,
          fileType,
          fileSize,
          createdAt: message.created_at,
          url: previewUrl,
          isImage: isImageByType(fileType, fileName),
        };

        return item;
      })
      .filter((item) => Boolean(item.url));
  }, [authToken, messages]);

  const imageItems = sharedMedia.filter((item) => item.isImage);
  const fileItems = sharedMedia.filter((item) => !item.isImage);

  const getMemberId = (member: ConversationMember) => {
    return typeof member.userId === "string" ? member.userId.trim() : "";
  };

  const getMemberDisplayName = (member: ConversationMember) => {
    const memberId = getMemberId(member);
    const fallbackName = memberId
      ? `Người dùng ${memberId.slice(0, 6)}`
      : "Người dùng không rõ";
    const profile = member.profile;
    const lookupByProfileId =
      typeof profile?.id === "string" ? userLookup?.[profile.id] : undefined;
    const lookupByMemberId = memberId ? userLookup?.[memberId] : undefined;
    const lookup = lookupByProfileId ?? lookupByMemberId;
    const candidate =
      profile?.fullName ||
      lookup?.fullName ||
      profile?.email ||
      lookup?.email ||
      profile?.phone ||
      lookup?.phone ||
      fallbackName;
    return typeof candidate === "string" ? candidate : fallbackName;
  };

  const getMemberAvatar = (member: ConversationMember) => {
    const profileId =
      typeof member.profile?.id === "string" ? member.profile.id : "";
    const memberId = getMemberId(member);
    return (
      member.profile?.avatarUrl ||
      (profileId ? userLookup?.[profileId]?.avatarUrl : undefined) ||
      (memberId ? userLookup?.[memberId]?.avatarUrl : undefined) ||
      null
    );
  };

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getConversation(conversationId);
      setConversation(response.data);
    } catch {
      setError("Không thể tải thông tin hội thoại.");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (conversationType !== "direct") {
      setDirectPeerId(null);
      setIsBlocked(false);
      setBlockedByCurrentUser(false);
      onBlockStateChange?.({
        isBlocked: false,
        blockedByCurrentUser: false,
      });
      return;
    }

    const peerId = resolveDirectPeerId(directPeer);
    setDirectPeerId(peerId);

    if (!peerId) {
      setIsBlocked(false);
      setBlockedByCurrentUser(false);
      onBlockStateChange?.({
        isBlocked: false,
        blockedByCurrentUser: false,
      });
      return;
    }

    if (!isUuidLike(peerId) || friendshipStatusEndpointUnavailableRef.current) {
      return;
    }

    const now = Date.now();
    const lastFetch = friendshipStatusFetchRef.current;
    const isSamePeer = lastFetch.peerId === peerId;
    const withinCooldown = now - lastFetch.lastFetchedAt < 15_000;
    if (lastFetch.inFlight || (isSamePeer && withinCooldown)) {
      return;
    }

    friendshipStatusFetchRef.current = {
      peerId,
      inFlight: true,
      lastFetchedAt: lastFetch.lastFetchedAt,
    };

    const loadStatus = async () => {
      try {
        const response = await getFriendshipStatus(peerId);
        const blocked = Boolean(response.data?.isBlocked);
        const blockedByMe =
          blocked && response.data?.blockedByUserId === currentUserId;

        setIsBlocked(blocked);
        setBlockedByCurrentUser(blockedByMe);
        onBlockStateChange?.({
          isBlocked: blocked,
          blockedByCurrentUser: blockedByMe,
        });
      } catch (error) {
        const typedError = error as { message?: string; status?: number };
        const message = typedError?.message ?? "";
        if (typedError?.status === 404 || message === "http_404") {
          friendshipStatusEndpointUnavailableRef.current = true;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(FRIENDSHIP_STATUS_UNSUPPORTED_KEY, "1");
          }
        }

        setIsBlocked(false);
        setBlockedByCurrentUser(false);
        onBlockStateChange?.({
          isBlocked: false,
          blockedByCurrentUser: false,
        });
      } finally {
        friendshipStatusFetchRef.current = {
          peerId,
          inFlight: false,
          lastFetchedAt: Date.now(),
        };
      }
    };

    void loadStatus();
  }, [conversationType, currentUserId, directPeer, onBlockStateChange]);

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
    if (
      !globalThis.confirm(
        "Bạn có chắc muốn giải tán nhóm này? Thao tác này không thể hoàn tác.",
      )
    ) {
      return;
    }

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
    if (!globalThis.confirm("Bạn có chắc muốn rời nhóm này?")) return;
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
    const member = members.find((m) => m.userId === userId);
    const name = member ? getMemberDisplayName(member) : "thành viên";
    if (!globalThis.confirm(`Bạn có chắc muốn xóa ${name} khỏi nhóm?`)) return;
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
      const memberIds = new Set(members.map((m) => m.userId));
      setFriends(response.data.filter((f) => !memberIds.has(f.id)));
    } catch {
      setError("Không thể tải danh sách bạn bè.");
    }
  }

  async function handleBlockToggle() {
    if (!directPeerId) {
      setError("Không thể chặn người dùng này ở hội thoại hiện tại.");
      return;
    }

    if (!isUuidLike(directPeerId)) {
      setError("Dữ liệu người dùng chưa hợp lệ để cập nhật chặn/mở chặn.");
      return;
    }

    if (isBlocked && !blockedByCurrentUser) {
      setError("Bạn đang bị chặn. Chỉ đối phương mới có thể mở chặn.");
      return;
    }

    setBusyAction("block");
    setError("");

    try {
      if (isBlocked && blockedByCurrentUser) {
        await unblockFriendship(directPeerId);
        setIsBlocked(false);
        setBlockedByCurrentUser(false);
        setNotice("Đã mở chặn người dùng này.");
        onBlockStateChange?.({
          isBlocked: false,
          blockedByCurrentUser: false,
        });
      } else {
        await blockFriendship(directPeerId);
        setIsBlocked(true);
        setBlockedByCurrentUser(true);
        setNotice("Đã chặn người dùng này.");
        onBlockStateChange?.({
          isBlocked: true,
          blockedByCurrentUser: true,
        });
      }
      onConversationUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "only_blocker_can_unblock") {
        setError("Chỉ người đã chặn mới có thể mở chặn.");
      } else {
        setError("Không thể cập nhật trạng thái chặn.");
      }
    } finally {
      setBusyAction("");
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
        <p className="text-sm text-slate-500">Không tìm thấy hội thoại.</p>
      </div>
    );
  }

  const headerName =
    conversationType === "direct" && directPeer
      ? getMemberDisplayName(directPeer)
      : (conversation.name ?? "Nhóm");
  const headerAvatar =
    conversationType === "direct" && directPeer
      ? getMemberAvatar(directPeer)
      : null;

  return (
    <div className="w-80 border-l border-slate-200 bg-white flex flex-col overflow-y-auto">
      <div className="flex flex-col items-center py-6 border-b border-slate-100 bg-[#f7f9fc]">
        {headerAvatar ? (
          <img
            src={headerAvatar}
            alt={headerName}
            className="w-20 h-20 rounded-full object-cover border-2 border-white shadow"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            {conversationType === "group" ? (
              <Users className="w-9 h-9 text-white" />
            ) : (
              <span className="text-2xl font-bold text-white">
                {headerName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        )}

        {conversationType === "group" && editingName ? (
          <div className="mt-3 flex items-center gap-2 px-4 w-full">
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
          <div className="mt-3 flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">{headerName}</h2>
            {conversationType === "group" && isOwner && (
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

        <p className="text-xs text-slate-500 mt-1">
          {conversationType === "group"
            ? `${members.length} thành viên`
            : "Thông tin hội thoại"}
        </p>
      </div>

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

      <div className="px-4 pt-4 space-y-2">
        <button
          type="button"
          onClick={() => onToggleMute(!isMuted)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          {isMuted ? (
            <BellOff className="w-4 h-4 text-amber-600" />
          ) : (
            <Bell className="w-4 h-4 text-blue-600" />
          )}
          <span>
            {isMuted ? "Đang tắt thông báo" : "Bật thông báo hội thoại"}
          </span>
        </button>

        {conversationType === "direct" && (
          <button
            type="button"
            onClick={() => void handleBlockToggle()}
            disabled={
              busyAction === "block" ||
              (isBlocked && !blockedByCurrentUser) ||
              !directPeerId ||
              !isUuidLike(directPeerId)
            }
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 ${
              isBlocked && blockedByCurrentUser
                ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                : "text-rose-700 bg-rose-50 hover:bg-rose-100"
            }`}
          >
            {isBlocked && blockedByCurrentUser ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <ShieldBan className="w-4 h-4" />
            )}
            <span>
              {isBlocked && blockedByCurrentUser
                ? "Mở chặn tin nhắn"
                : isBlocked
                  ? "Bạn đang bị chặn"
                  : "Chặn tin nhắn"}
            </span>
          </button>
        )}
      </div>

      {conversationType === "group" && (
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

          {showAddMember && (
            <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">
                  Thêm bạn bè
                </span>
                <button onClick={() => setShowAddMember(false)}>
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
              {friends.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Không có bạn bè nào để thêm.
                </p>
              ) : (
                <>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {friends.map((friend) => (
                      <label
                        key={friend.id}
                        className="flex items-center gap-2 py-1 cursor-pointer text-xs"
                      >
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
                    {busyAction === "add"
                      ? "Đang thêm..."
                      : `Thêm (${addingIds.size})`}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="space-y-1">
            {members.map((member, index) => {
              const memberId = getMemberId(member);
              const name = getMemberDisplayName(member);
              const initials = name
                .split(" ")
                .map((part: string) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const avatarUrl = getMemberAvatar(member);
              const isSelf = memberId === currentUserId;
              const isOwnerMember = member.role === "owner";

              return (
                <div
                  key={memberId || `member-${index}`}
                  className="flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
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
                        <span className="text-[10px] text-slate-400">
                          (Bạn)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      {isOwnerMember ? (
                        <>
                          <Crown className="w-3 h-3 text-amber-500" />
                          <span>Chủ nhóm</span>
                        </>
                      ) : (
                        <span>Thành viên</span>
                      )}
                    </div>
                  </div>
                  {isOwner && !isSelf && memberId && (
                    <button
                      onClick={() => handleRemoveMember(memberId)}
                      disabled={busyAction === `remove-${memberId}`}
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
      )}

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-700">Ảnh/Video</h3>
          <ImageIcon className="w-4 h-4 text-slate-400" />
        </div>

        {imageItems.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có ảnh/video.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {imageItems.slice(0, 9).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-md border border-slate-200 bg-slate-50"
              >
                <img
                  src={item.url}
                  alt={item.fileName}
                  className="h-20 w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-700">File</h3>
          <Link2 className="w-4 h-4 text-slate-400" />
        </div>

        {fileItems.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có file được gửi.</p>
        ) : (
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {fileItems.slice(0, 20).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 hover:bg-slate-100"
              >
                <div className="mt-0.5 text-slate-500">📄</div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-700">
                    {item.fileName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {item.fileSize > 0
                      ? `${(item.fileSize / 1024).toFixed(2)} KB`
                      : "Không rõ dung lượng"}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {conversationType === "group" && (
        <div className="p-4 space-y-2 border-t border-slate-100">
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
      )}
    </div>
  );
}
