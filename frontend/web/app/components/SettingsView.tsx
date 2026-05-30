"use client";

import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Globe, Lock, Monitor, Moon, Shield, Sun } from "lucide-react";
import { clearAuthSession, getAuthToken } from "../lib/auth";
import { WEB_GATEWAY_BASE_URL } from "../lib/runtime-base-url";
import { getMe } from "../lib/users";

type SettingsCategory = "security" | "appearance";

export type AppLanguage = "vi" | "en";
export type AppTheme = "light" | "dark";

interface SettingsViewProps {
  language: AppLanguage;
  theme: AppTheme;
  onLanguageChange: (language: AppLanguage) => void;
  onThemeChange: (theme: AppTheme) => void;
}

export default function SettingsView({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: Readonly<SettingsViewProps>) {
  const t =
    language === "en"
      ? {
          title: "Settings",
          category: "CATEGORY",
          security: "Security",
          appearance: "Appearance",
          securityTitle: "Security",
          chooseChangePassword: "Choose Change Password",
          currentPassword: "Current password",
          newPassword: "New password",
          confirmPassword: "Confirm new password",
          currentPlaceholder: "Enter current password",
          newPlaceholder: "Enter new password",
          confirmPlaceholder: "Re-enter new password",
          changePassword: "Change password",
          changing: "Changing...",
          languageTitle: "Language",
          vietnamese: "Vietnamese",
          english: "English",
          themeTitle: "Theme",
          light: "Light",
          dark: "Dark",
          fillAll: "Please fill all fields.",
          minLength: "New password must be at least 8 characters.",
          mismatch: "Password confirmation does not match.",
          expired: "Session expired. Please log in again.",
          noEndpoint: "Change-password endpoint is not enabled on server yet.",
          changeFail: "Unable to change password. Please try again.",
          googleNoPasswordChange:
            "Password change feature is not available for Google accounts!",
          changed: "Password changed successfully.",
          connectFail: "Cannot connect to server. Please try again.",
          successTitle: "Password changed successfully",
          successDesc: "You will be signed out in",
          seconds: "seconds",
          reloginHint: "Please sign in again to use a new token.",
          invalidOrExpiredToken: "Session expired. Please log in again.",
          currentPasswordInvalid: "Current password is incorrect.",
          newPasswordMustDiffer: "New password must be different from current password.",
          userNotFound: "User not found.",
          validationError: "Invalid data. Please check your input.",
          serverError: "Server error. Please try again later.",
        }
      : {
          title: "Cài đặt",
          category: "DANH MỤC",
          security: "Bảo mật",
          appearance: "Giao diện",
          securityTitle: "Bảo mật",
          chooseChangePassword: "Chọn đổi mật khẩu",
          currentPassword: "Mật khẩu hiện tại",
          newPassword: "Mật khẩu mới",
          confirmPassword: "Xác nhận mật khẩu mới",
          currentPlaceholder: "Nhập mật khẩu hiện tại",
          newPlaceholder: "Nhập mật khẩu mới",
          confirmPlaceholder: "Nhập lại mật khẩu mới",
          changePassword: "Đổi mật khẩu",
          changing: "Đang đổi...",
          languageTitle: "Ngôn ngữ",
          vietnamese: "Tiếng Việt",
          english: "English",
          themeTitle: "Chủ đề",
          light: "Sáng",
          dark: "Tối",
          fillAll: "Vui lòng nhập đầy đủ thông tin.",
          minLength: "Mật khẩu mới cần tối thiểu 8 ký tự.",
          mismatch: "Mật khẩu xác nhận không khớp.",
          expired: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
          noEndpoint: "Chức năng đổi mật khẩu chưa được bật trên máy chủ.",
          changeFail: "Không thể đổi mật khẩu. Vui lòng thử lại.",
          googleNoPasswordChange:
            "Tính năng đổi mật khẩu không khả dụng với tài khoản google!",
          changed: "Đổi mật khẩu thành công.",
          connectFail: "Không thể kết nối máy chủ. Vui lòng thử lại.",
          successTitle: "Thay đổi mật khẩu thành công",
          successDesc: "Bạn sẽ được đăng xuất sau",
          seconds: "giây",
          reloginHint: "Vui lòng đăng nhập lại để dùng token mới.",
          invalidOrExpiredToken: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
          currentPasswordInvalid: "Mật khẩu hiện tại không đúng.",
          newPasswordMustDiffer: "Mật khẩu mới phải khác mật khẩu hiện tại.",
          userNotFound: "Không tìm thấy người dùng.",
          validationError: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.",
          serverError: "Máy chủ đang bận. Vui lòng thử lại sau.",
        };
  const [category, setCategory] = useState<SettingsCategory>("security");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(3);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [canChangePassword, setCanChangePassword] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadMe = async () => {
      try {
        const response = await getMe();
        if (!isMounted) return;
        setCanChangePassword(response.data.canChangePassword !== false);
      } catch {
        if (!isMounted) return;
        setCanChangePassword(true);
      }
    };
    void loadMe();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChangePassword = async () => {
    setPasswordNotice("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordNotice(t.fillAll);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordNotice(t.minLength);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordNotice(t.mismatch);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setPasswordNotice(t.expired);
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch(`${WEB_GATEWAY_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        if (response.status === 404) {
          setPasswordNotice(t.noEndpoint);
          return;
        }
        const rawCode = payload.message ?? "";
        const backendErrorMap: Record<string, string> = {
          invalid_or_expired_token: t.invalidOrExpiredToken,
          missing_bearer_token: t.invalidOrExpiredToken,
          current_password_invalid: t.currentPasswordInvalid,
          new_password_must_differ: t.newPasswordMustDiffer,
          user_not_found: t.userNotFound,
          validation_error: t.validationError,
        };
        if (backendErrorMap[rawCode]) {
          setPasswordNotice(backendErrorMap[rawCode]);
          return;
        }
        if (response.status >= 500) {
          setPasswordNotice(t.serverError);
          return;
        }
        setPasswordNotice(t.changeFail);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice("");
      setLogoutCountdown(3);
      setShowSuccessModal(true);

      const timer = window.setInterval(() => {
        setLogoutCountdown((prev) => {
          if (prev <= 1) {
            window.clearInterval(timer);
            clearAuthSession();
            window.location.href = "/login";
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setPasswordNotice(t.connectFail);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#eef2f7] p-6">
      <h1 className="mb-6 text-center text-4xl font-bold text-slate-900">{t.title}</h1>
      <div className="mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-lg font-bold text-slate-500">{t.category}</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setCategory("security")}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${
                category === "security"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Shield className="h-5 w-5" />
              <span className="text-lg font-medium">{t.security}</span>
            </button>
            <button
              type="button"
              onClick={() => setCategory("appearance")}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${
                category === "appearance"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Monitor className="h-5 w-5" />
              <span className="text-lg font-medium">{t.appearance}</span>
            </button>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {category === "security" ? (
            <>
              <h2 className="mb-5 text-4xl font-bold text-slate-900">{t.securityTitle}</h2>
              <button
                type="button"
                onClick={() => {
                  setPasswordNotice("");
                  setShowPasswordForm((prev) => !prev);
                }}
                disabled={!canChangePassword}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <Lock className="h-4 w-4" />
                {t.chooseChangePassword}
              </button>

              {!canChangePassword && (
                <p className="mt-3 text-sm font-medium text-red-600">{t.googleNoPasswordChange}</p>
              )}

              {showPasswordForm && canChangePassword && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">
                      {t.currentPassword}
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t.currentPlaceholder}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                        aria-label={showCurrentPassword ? "Ẩn mật khẩu hiện tại" : "Hiện mật khẩu hiện tại"}
                        title={showCurrentPassword ? "Ẩn mật khẩu hiện tại" : "Hiện mật khẩu hiện tại"}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">
                      {t.newPassword}
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t.newPlaceholder}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                        aria-label={showNewPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                        title={showNewPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">
                      {t.confirmPassword}
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t.confirmPlaceholder}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                        aria-label={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
                        title={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {passwordNotice && (
                <p className="mt-4 text-sm text-slate-600">{passwordNotice}</p>
              )}

              {showPasswordForm && canChangePassword && (
                <button
                  type="button"
                  onClick={() => void handleChangePassword()}
                  disabled={changingPassword}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Lock className="h-4 w-4" />
                  {changingPassword ? t.changing : t.changePassword}
                </button>
              )}
            </>
          ) : (
            <>
              <h2 className="mb-5 text-4xl font-bold text-slate-900">{t.appearance}</h2>
              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-base font-semibold text-slate-700">{t.languageTitle}</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => onLanguageChange("vi")}
                      className={`rounded-lg px-4 py-2 font-medium ${
                        language === "vi"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {t.vietnamese}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onLanguageChange("en")}
                      className={`rounded-lg px-4 py-2 font-medium ${
                        language === "en"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {t.english}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-base font-semibold text-slate-700">{t.themeTitle}</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => onThemeChange("light")}
                      className={`rounded-lg px-4 py-2 font-medium ${
                        theme === "light"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        {t.light}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onThemeChange("dark")}
                      className={`rounded-lg px-4 py-2 font-medium ${
                        theme === "dark"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        {t.dark}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-slate-900">{t.successTitle}</h3>
            <p className="mt-3 text-sm text-slate-600">
              {t.successDesc} <span className="font-semibold">{logoutCountdown}</span> {t.seconds}.
            </p>
            <p className="mt-1 text-sm text-slate-500">{t.reloginHint}</p>
          </div>
        </div>
      )}
    </div>
  );
}
