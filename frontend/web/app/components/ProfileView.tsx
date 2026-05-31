"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { LogOut, Pencil, RefreshCw, Save, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAuthSession } from "../lib/auth";
import type { AppLanguage } from "./SettingsView";
import {
  getMe,
  updateAvatar,
  updateCover,
  updateMe,
  type ProfileUser,
} from "../lib/users";

export default function ProfileView({
  language = "vi",
}: Readonly<{ language?: AppLanguage }>) {
  const router = useRouter();
  const t =
    language === "en"
      ? {
          user: "User",
          title: "My Profile",
          subtitle: "Keep your account details and contact information up to date.",
          refresh: "Refresh",
          signOut: "Sign Out",
          loading: "Loading profile...",
          coverAlt: "Cover",
          updatingAvatar: "Updating avatar...",
          updatingCover: "Updating cover...",
          clickPencil: "Click the pencil icons to change avatar and cover photo.",
          profileDetails: "Profile Details",
          emailManaged: "Your email is managed by the account identity.",
          fullName: "Full Name",
          phoneNumber: "Phone Number",
          email: "Email",
          status: "Status",
          active: "Active",
          inactive: "Inactive",
          bio: "Bio",
          saving: "Saving...",
          saveChanges: "Save Changes",
          profileUpdated: "Profile updated successfully.",
          avatarUpdated: "Avatar updated successfully.",
          coverUpdated: "Cover photo updated successfully.",
          errMissingSession: "Please sign in before managing your profile.",
          errMissingBearer: "Please sign in before managing your profile.",
          errExpired: "Your session has expired. Please sign in again.",
          errPhoneUsed: "This phone number is already used by another account.",
          errValidation: "Please check the fields and try again.",
          errNotFound: "We could not find your user account.",
          errAvatarType: "Please choose an image file for avatar.",
          errCoverType: "Please choose an image file for cover photo.",
          errAvatarSize: "Avatar image must be 2MB or smaller.",
          errCoverSize: "Cover image must be 4MB or smaller.",
          errReadImage: "Could not read the selected image.",
          errUnknown: "Something went wrong. Please try again.",
        }
      : {
          user: "Người dùng",
          title: "Hồ sơ của tôi",
          subtitle: "Cập nhật thông tin tài khoản và liên hệ của bạn.",
          refresh: "Làm mới",
          signOut: "Đăng xuất",
          loading: "Đang tải hồ sơ...",
          coverAlt: "Ảnh bìa",
          updatingAvatar: "Đang cập nhật ảnh đại diện...",
          updatingCover: "Đang cập nhật ảnh bìa...",
          clickPencil: "Nhấn biểu tượng bút để đổi ảnh đại diện và ảnh bìa.",
          profileDetails: "Chi tiết hồ sơ",
          emailManaged: "Email được quản lý bởi định danh tài khoản.",
          fullName: "Họ và tên",
          phoneNumber: "Số điện thoại",
          email: "Email",
          status: "Trạng thái",
          active: "Hoạt động",
          inactive: "Không hoạt động",
          bio: "Tiểu sử",
          saving: "Đang lưu...",
          saveChanges: "Lưu thay đổi",
          profileUpdated: "Cập nhật hồ sơ thành công.",
          avatarUpdated: "Cập nhật ảnh đại diện thành công.",
          coverUpdated: "Cập nhật ảnh bìa thành công.",
          errMissingSession: "Vui lòng đăng nhập trước khi quản lý hồ sơ.",
          errMissingBearer: "Vui lòng đăng nhập trước khi quản lý hồ sơ.",
          errExpired: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
          errPhoneUsed: "Số điện thoại này đã được tài khoản khác sử dụng.",
          errValidation: "Vui lòng kiểm tra lại dữ liệu đã nhập.",
          errNotFound: "Không tìm thấy tài khoản người dùng.",
          errAvatarType: "Vui lòng chọn tệp ảnh cho ảnh đại diện.",
          errCoverType: "Vui lòng chọn tệp ảnh cho ảnh bìa.",
          errAvatarSize: "Ảnh đại diện phải nhỏ hơn hoặc bằng 2MB.",
          errCoverSize: "Ảnh bìa phải nhỏ hơn hoặc bằng 4MB.",
          errReadImage: "Không thể đọc tệp ảnh đã chọn.",
          errUnknown: "Đã có lỗi xảy ra. Vui lòng thử lại.",
        };
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingCover, setSavingCover] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const initials = useMemo(() => {
    const source = user?.fullName || user?.email || t.user;
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
    } catch (err) {
      setError(getFriendlyError(err, t));
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
      setMessage(t.profileUpdated);
    } catch (err) {
      setError(getFriendlyError(err, t));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSavingAvatar(true);
    setError("");
    setMessage("");
    try {
      const imageDataUrl = await toImageDataUrl(file, 2, "Avatar");
      const response = await updateAvatar(imageDataUrl);
      setUser((current) =>
        current ? { ...current, avatarUrl: response.data.avatarUrl } : current,
      );
      setMessage(t.avatarUpdated);
    } catch (err) {
      setError(getFriendlyError(err, t));
    } finally {
      setSavingAvatar(false);
    }
  }

  async function handleCoverFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSavingCover(true);
    setError("");
    setMessage("");
    try {
      const imageDataUrl = await toImageDataUrl(file, 4, "Cover");
      const response = await updateCover(imageDataUrl);
      setUser((current) =>
        current ? { ...current, coverUrl: response.data.coverUrl ?? null } : current,
      );
      setMessage(t.coverUpdated);
    } catch (err) {
      setError(getFriendlyError(err, t));
    } finally {
      setSavingCover(false);
    }
  }

  function toImageDataUrl(file: File, maxMb: number, label: string) {
    const maxBytes = maxMb * 1024 * 1024;

    if (!file.type.startsWith("image/")) {
      throw new Error(`${label}_image_must_be_image_file`);
    }

    if (file.size > maxBytes) {
      throw new Error(`${label}_image_must_be_${maxMb}MB_or_smaller`);
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Could_not_read_the_selected_image"));
      };
      reader.onerror = () => reject(new Error("Could_not_read_the_selected_image"));
      reader.readAsDataURL(file);
    });
  }

  function handleLogout() {
    clearAuthSession();
    router.push("/login");
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8 h-full font-sans text-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {t.subtitle}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => void loadProfile()}
            className="bg-white border border-slate-200 text-slate-700 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            {t.refresh}
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            {t.signOut}
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
          {t.loading}
        </div>
      ) : (
        <div className="grid grid-cols-[320px_1fr] gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-fit">
            <div className="flex flex-col items-center text-center">
              <div className="relative w-full">
                <div className="h-28 w-full overflow-hidden rounded-xl bg-slate-100">
                  {user?.coverUrl ? (
                    <img
                      src={user.coverUrl}
                      alt={t.coverAlt}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <label className="absolute bottom-2 right-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-slate-700 shadow border border-slate-200 hover:bg-slate-50">
                  <Pencil className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFileChange}
                    disabled={savingCover}
                    className="sr-only"
                  />
                </label>
              </div>
              <div className="relative -mt-10">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-sm"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-sm border-4 border-white">
                    {initials}
                  </div>
                )}
                <label className="absolute bottom-1 right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-slate-700 shadow border border-slate-200 hover:bg-slate-50">
                  <Pencil className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    disabled={savingAvatar}
                    className="sr-only"
                  />
                </label>
              </div>
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
            <p className="mt-4 text-xs text-slate-500">
              {savingAvatar
                ? t.updatingAvatar
                : savingCover
                  ? t.updatingCover
                  : t.clickPencil}
            </p>
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
                <h3 className="font-bold">{t.profileDetails}</h3>
                <p className="text-sm text-slate-500">
                  {t.emailManaged}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t.fullName}>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 px-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label={t.phoneNumber}>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 px-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label={t.email}>
                <input
                  value={user?.email ?? ""}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 text-sm rounded-lg py-2.5 px-3 text-slate-500"
                />
              </Field>
              <Field label={t.status}>
                <input
                  value={user?.isActive === false ? t.inactive : t.active}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 text-sm rounded-lg py-2.5 px-3 text-slate-500"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label={t.bio}>
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
                {savingProfile ? t.saving : t.saveChanges}
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

function getFriendlyError(
  error: unknown,
  t: {
    errMissingSession: string;
    errMissingBearer: string;
    errExpired: string;
    errPhoneUsed: string;
    errValidation: string;
    errNotFound: string;
    errAvatarType: string;
    errCoverType: string;
    errAvatarSize: string;
    errCoverSize: string;
    errReadImage: string;
    errUnknown: string;
  },
) {
  const message = error instanceof Error ? error.message : "request_failed";
  const labels: Record<string, string> = {
    missing_local_session: t.errMissingSession,
    missing_bearer_token: t.errMissingBearer,
    invalid_or_expired_token: t.errExpired,
    phone_already_used: t.errPhoneUsed,
    validation_error: t.errValidation,
    user_not_found: t.errNotFound,
    Avatar_image_must_be_image_file: t.errAvatarType,
    Cover_image_must_be_image_file: t.errCoverType,
    Avatar_image_must_be_2MB_or_smaller: t.errAvatarSize,
    Cover_image_must_be_4MB_or_smaller: t.errCoverSize,
    Could_not_read_the_selected_image: t.errReadImage,
  };

  return labels[message] ?? t.errUnknown;
}
