"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { Camera, LogOut, RefreshCw, Save, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAuthSession } from "../lib/auth";
import {
  getMe,
  updateAvatar,
  updateMe,
  type ProfileUser,
} from "../lib/users";

export default function ProfileView() {
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFileName, setAvatarFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const initials = useMemo(() => {
    const source = user?.fullName || user?.email || "User";
    return source
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const response = await getMe();
      setUser(response.data);
      setFullName(response.data.fullName ?? "");
      setPhone(response.data.phone ?? "");
      setBio(response.data.bio ?? "");
      setAvatarUrl(response.data.avatarUrl ?? "");
      setAvatarFileName("");
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setMessage("");

    try {
      const response = await updateMe({
        fullName,
        phone,
        bio,
      });
      setUser(response.data);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!avatarUrl) {
      setError("Please choose an image file first.");
      return;
    }

    setSavingAvatar(true);
    setError("");
    setMessage("");

    try {
      const response = await updateAvatar(avatarUrl);
      setUser((current) =>
        current ? { ...current, avatarUrl: response.data.avatarUrl } : current,
      );
      setAvatarFileName("");
      setMessage("Avatar updated successfully.");
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setSavingAvatar(false);
    }
  }

  function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar image must be 2MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
        setAvatarFileName(file.name);
        setError("");
        setMessage("Avatar selected. Click Update Avatar to save it.");
      }
    };
    reader.onerror = () => {
      setError("Could not read the selected image.");
    };
    reader.readAsDataURL(file);
  }

  function handleLogout() {
    clearAuthSession();
    router.push("/login");
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8 h-full font-sans text-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-slate-500 text-sm mt-1">
            Keep your account details and contact information up to date.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => void loadProfile()}
            className="bg-white border border-slate-200 text-slate-700 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 p-6 text-sm text-slate-500">
          Loading profile...
        </div>
      ) : (
        <div className="grid grid-cols-[320px_1fr] gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-fit">
            <div className="flex flex-col items-center text-center">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-sm"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-sm">
                  {initials}
                </div>
              )}
              <h2 className="mt-4 text-lg font-bold">{user?.fullName}</h2>
              <p className="text-sm text-slate-500 mt-1">{user?.email}</p>
              <div className="flex gap-2 mt-4">
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                  {user?.role ?? "USER"}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                  {user?.plan}
                </span>
              </div>
            </div>

            <form onSubmit={handleAvatarSubmit} className="mt-6 space-y-3">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Avatar Image
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600">
                <Camera className="w-4 h-4" />
                Choose image from device
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="sr-only"
                />
              </label>
              <p className="min-h-5 text-xs text-slate-500">
                {avatarFileName || "PNG, JPG, or WEBP up to 2MB."}
              </p>
              <button
                disabled={savingAvatar || !avatarUrl}
                className="w-full bg-blue-600 text-white flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-70"
              >
                <Camera className="w-4 h-4" />
                {savingAvatar ? "Saving avatar..." : "Update Avatar"}
              </button>
            </form>
          </div>

          <form
            onSubmit={handleProfileSubmit}
            className="bg-white rounded-xl shadow-sm border border-slate-100 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <UserRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">Profile Details</h3>
                <p className="text-sm text-slate-500">
                  Your email is managed by the account identity.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name">
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 px-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="Phone Number">
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 px-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="Email">
                <input
                  value={user?.email ?? ""}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 text-sm rounded-lg py-2.5 px-3 text-slate-500"
                />
              </Field>
              <Field label="Status">
                <input
                  value={user?.isActive === false ? "Inactive" : "Active"}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 text-sm rounded-lg py-2.5 px-3 text-slate-500"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Bio">
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={5}
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 px-3 outline-none resize-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                disabled={savingProfile}
                className="bg-blue-600 text-white flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-70"
              >
                <Save className="w-4 h-4" />
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function getFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "request_failed";
  const labels: Record<string, string> = {
    missing_local_session: "Please sign in before managing your profile.",
    missing_bearer_token: "Please sign in before managing your profile.",
    invalid_or_expired_token: "Your session has expired. Please sign in again.",
    phone_already_used: "This phone number is already used by another account.",
    validation_error: "Please check the fields and try again.",
    user_not_found: "We could not find your user account.",
  };

  return labels[message] ?? "Something went wrong. Please try again.";
}
