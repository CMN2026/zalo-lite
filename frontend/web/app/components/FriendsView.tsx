"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Search,
  Send,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  discoverUsers,
  getMe,
  listFriends,
  listIncomingFriendRequests,
  respondFriendRequest,
  sendFriendRequest,
  type FriendRequest,
  type ProfileUser,
} from "../lib/users";

type TabId = "friends" | "search" | "requests";

export default function FriendsView() {
  const [activeTab, setActiveTab] = useState<TabId>("friends");
  const [currentPhone, setCurrentPhone] = useState("");
  const [friends, setFriends] = useState<ProfileUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<ProfileUser[]>([]);
  const [phoneQuery, setPhoneQuery] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [friendFilter, setFriendFilter] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const filteredFriends = useMemo(() => {
    const query = friendFilter.trim().toLowerCase();
    if (!query) {
      return friends;
    }

    return friends.filter((friend) => {
      return (
        friend.fullName.toLowerCase().includes(query) ||
        (friend.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [friends, friendFilter]);

  useEffect(() => {
    void refreshFriends();
    void refreshRequests();
    void loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const response = await getMe();
      setCurrentPhone(response.data.phone ?? "");
    } catch {
      setCurrentPhone("");
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshRequests({ silent: true });

      if (activeTab === "friends") {
        void refreshFriends({ silent: true });
      }
    }, 4000);

    return () => {
      clearInterval(timer);
    };
  }, [activeTab]);

  async function refreshFriends(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoadingFriends(true);
      setError("");
    }

    try {
      const response = await listFriends();
      setFriends(response.data);
    } catch (err) {
      if (!silent) {
        setError(getFriendlyError(err));
      }
    } finally {
      if (!silent) {
        setLoadingFriends(false);
      }
    }
  }

  async function refreshRequests(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoadingRequests(true);
      setError("");
    }

    try {
      const response = await listIncomingFriendRequests();
      setIncomingRequests(response.data);
    } catch (err) {
      if (!silent) {
        setError(getFriendlyError(err));
      }
    } finally {
      if (!silent) {
        setLoadingRequests(false);
      }
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = phoneQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError("");
    setNotice("");

    try {
      const response = await discoverUsers(query);
      setSearchResults(response.data);
      if (response.data.length === 0) {
        setNotice("No active users matched that phone number.");
      }
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(user: ProfileUser) {
    if (!user.phone) {
      setError("This user does not have a phone number.");
      return;
    }

    setBusyId(user.id);
    setError("");
    setNotice("");

    try {
      await sendFriendRequest(user.phone, requestMessage || undefined);
      setNotice(`Friend request sent to ${user.fullName}.`);
      setSearchResults((current) =>
        current.filter((item) => item.id !== user.id),
      );
      await refreshFriends();
      await refreshRequests();
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleRespond(
    request: FriendRequest,
    action: "accept" | "reject",
  ) {
    setBusyId(request.id);
    setError("");
    setNotice("");

    try {
      await respondFriendRequest(request.id, action);
      setIncomingRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
      setNotice(
        action === "accept"
          ? "Friend request accepted."
          : "Friend request rejected.",
      );
      if (action === "accept") {
        void refreshFriends();
      }
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8 h-full font-sans text-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Friends</h1>
          <p className="text-slate-500 text-sm mt-1">
            Search by phone number, manage invitations, and keep your contact
            list current.
          </p>
          {currentPhone && (
            <p className="text-xs text-slate-400 mt-1">
              Signed in phone: {currentPhone}
            </p>
          )}
        </div>
        <div className="flex bg-white border border-slate-200 rounded-lg p-1">
          <TabButton
            active={activeTab === "friends"}
            onClick={() => setActiveTab("friends")}
            icon={<Users className="w-4 h-4" />}
            label="Friends"
          />
          <TabButton
            active={activeTab === "search"}
            onClick={() => setActiveTab("search")}
            icon={<UserPlus className="w-4 h-4" />}
            label="Find"
          />
          <TabButton
            active={activeTab === "requests"}
            onClick={() => setActiveTab("requests")}
            icon={<UserCheck className="w-4 h-4" />}
            label="Requests"
            badgeCount={incomingRequests.length}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {notice}
        </div>
      )}

      {activeTab === "friends" && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={friendFilter}
                onChange={(event) => setFriendFilter(event.target.value)}
                placeholder="Search friends..."
                className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2 pl-9 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => void refreshFriends()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          {loadingFriends ? (
            <EmptyState text="Loading friends..." />
          ) : filteredFriends.length === 0 ? (
            <EmptyState text="No friends found yet." />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredFriends.map((friend) => (
                <UserRow
                  key={friend.id}
                  user={friend}
                  meta={friend.phone ?? "No phone number"}
                  action={
                    <span className="bg-green-50 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                      Friend
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "search" && (
        <section className="grid grid-cols-[360px_1fr] gap-6">
          <form
            onSubmit={handleSearch}
            className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-fit"
          >
            <h2 className="font-bold text-lg">Find by Phone</h2>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              Enter a phone number or a partial match.
            </p>
            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase text-slate-500">
                Phone Number
              </span>
              <input
                value={phoneQuery}
                onChange={(event) => setPhoneQuery(event.target.value)}
                placeholder="0911222333"
                className="mt-1 w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 px-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block mb-5">
              <span className="text-xs font-semibold uppercase text-slate-500">
                Optional Message
              </span>
              <textarea
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                rows={4}
                maxLength={150}
                placeholder="Let's connect."
                className="mt-1 w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 px-3 outline-none resize-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <button
              disabled={searching}
              className="w-full bg-blue-600 text-white flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-70"
            >
              <Search className="w-4 h-4" />
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="font-bold">Search Results</h2>
              <p className="text-sm text-slate-500">
                Send an invitation to active users returned by the server.
              </p>
            </div>
            {searchResults.length === 0 ? (
              <EmptyState text="Search results will appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {searchResults.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    meta={user.phone ?? "No phone number"}
                    action={
                      <button
                        onClick={() => void handleSendRequest(user)}
                        disabled={busyId === user.id}
                        className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-70"
                      >
                        <Send className="w-4 h-4" />
                        {busyId === user.id ? "Sending..." : "Add Friend"}
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "requests" && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Incoming Requests</h2>
              <p className="text-sm text-slate-500">
                Accept or reject people who want to connect with you.
              </p>
            </div>
            <button
              onClick={() => void refreshRequests()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          {loadingRequests ? (
            <EmptyState text="Loading requests..." />
          ) : incomingRequests.length === 0 ? (
            <EmptyState text="No incoming friend requests." />
          ) : (
            <div className="divide-y divide-slate-100">
              {incomingRequests.map((request) => {
                const requester = request.requester;
                return (
                  <UserRow
                    key={request.id}
                    user={requester}
                    fallbackName="Unknown requester"
                    meta={request.message || requester?.phone || "No message"}
                    action={
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleRespond(request, "accept")}
                          disabled={busyId === request.id}
                          className="bg-green-600 text-white flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-70"
                        >
                          <Check className="w-4 h-4" />
                          Accept
                        </button>
                        <button
                          onClick={() => void handleRespond(request, "reject")}
                          disabled={busyId === request.id}
                          className="bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-70"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badgeCount,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badgeCount?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
        active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {Boolean(badgeCount) && (
        <span className="absolute -left-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white shadow-sm">
          {badgeCount}
        </span>
      )}
      {icon}
      {label}
    </button>
  );
}

function UserRow({
  user,
  meta,
  action,
  fallbackName = "Unknown user",
}: {
  user?: ProfileUser;
  meta: string;
  action: React.ReactNode;
  fallbackName?: string;
}) {
  const name = user?.fullName ?? fallbackName;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="p-4 flex items-center gap-3">
      {user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={name}
          className="w-11 h-11 rounded-full object-cover"
        />
      ) : (
        <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{name}</div>
        <div className="text-xs text-slate-500 truncate mt-0.5">{meta}</div>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-slate-500">{text}</div>;
}

function getFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "request_failed";
  const labels: Record<string, string> = {
    missing_local_session: "Please sign in before managing friends.",
    missing_bearer_token: "Please sign in before managing friends.",
    invalid_or_expired_token: "Your session has expired. Please sign in again.",
    validation_error: "Please check the input and try again.",
    target_user_not_found: "No user exists with that phone number.",
    target_user_inactive: "That user account is inactive.",
    cannot_add_yourself: "You cannot add yourself as a friend.",
    already_friends: "You are already friends with this user.",
    friend_request_already_pending: "A friend request is already pending.",
    friendship_blocked: "This friendship is blocked.",
    friend_request_not_found: "This request no longer exists.",
    friend_request_already_processed: "This request was already processed.",
  };

  return labels[message] ?? "Something went wrong. Please try again.";
}
