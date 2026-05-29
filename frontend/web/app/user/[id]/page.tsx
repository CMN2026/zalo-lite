"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { WEB_GATEWAY_BASE_URL } from "../../lib/runtime-base-url";

type PublicUserProfile = {
  id: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
};

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params?.id ?? "";
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const initials = useMemo(() => {
    const source = profile?.fullName || profile?.email || "U";
    return source
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [profile]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${WEB_GATEWAY_BASE_URL}/api/users/${userId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error("fetch_user_profile_failed");
        const payload = (await response.json()) as { data?: PublicUserProfile };
        if (!payload.data) throw new Error("user_not_found");
        setProfile(payload.data);
      } catch {
        setError("Không thể tải hồ sơ người dùng.");
      } finally {
        setLoading(false);
      }
    };

    void fetchProfile();
  }, [userId]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 border border-slate-200 hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>

        {loading ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 text-sm text-slate-500">Đang tải hồ sơ...</div>
        ) : error ? (
          <div className="rounded-2xl bg-white border border-red-200 p-6 text-sm text-red-600">{error}</div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="h-48 bg-slate-200">
              {profile?.coverUrl && (
                <img src={profile.coverUrl} alt="Cover" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="px-6 pb-6">
              <div className="-mt-12 mb-4">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.fullName ?? "Avatar"} className="w-24 h-24 rounded-full border-4 border-white object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-white bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">
                    {initials}
                  </div>
                )}
              </div>

              <h1 className="text-2xl font-bold text-slate-900">{profile?.fullName || "Người dùng"}</h1>
              <p className="text-sm text-slate-500 mt-1">{profile?.email || "Không có email hiển thị"}</p>

              <div className="mt-6 grid gap-3 text-sm text-slate-700">
                <div>
                  <span className="font-semibold text-slate-500">Bio: </span>
                  {profile?.bio || "Chưa cập nhật"}
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Giới tính: </span>
                  {profile?.gender || "Chưa cập nhật"}
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Ngày sinh: </span>
                  {profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("vi-VN") : "Chưa cập nhật"}
                </div>
              </div>

              <button
                onClick={() => router.push("/")}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <MessageSquare className="w-4 h-4" />
                Về trang chính
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

