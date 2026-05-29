"use client";

import React, { useState } from "react";
import { Globe, Lock, Monitor, Moon, Shield, Sun } from "lucide-react";
import { getAuthToken } from "../lib/auth";
import { WEB_GATEWAY_BASE_URL } from "../lib/runtime-base-url";

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
  const [category, setCategory] = useState<SettingsCategory>("security");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");

  const handleChangePassword = async () => {
    setPasswordNotice("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordNotice("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordNotice("Mật khẩu mới cần tối thiểu 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordNotice("Mật khẩu xác nhận không khớp.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setPasswordNotice("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
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
          setPasswordNotice("Chức năng đổi mật khẩu chưa được bật trên máy chủ.");
          return;
        }
        setPasswordNotice(payload.message || "Không thể đổi mật khẩu. Vui lòng thử lại.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice("Đổi mật khẩu thành công.");
    } catch {
      setPasswordNotice("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#eef2f7] p-6">
      <h1 className="mb-6 text-center text-4xl font-bold text-slate-900">Cài đặt</h1>
      <div className="mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-lg font-bold text-slate-500">DANH MỤC</p>
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
              <span className="text-lg font-medium">Bảo mật</span>
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
              <span className="text-lg font-medium">Giao diện</span>
            </button>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {category === "security" ? (
            <>
              <h2 className="mb-5 text-4xl font-bold text-slate-900">Bảo mật</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập mật khẩu mới"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập lại mật khẩu mới"
                  />
                </div>
              </div>

              {passwordNotice && (
                <p className="mt-4 text-sm text-slate-600">{passwordNotice}</p>
              )}

              <button
                type="button"
                onClick={() => void handleChangePassword()}
                disabled={changingPassword}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Lock className="h-4 w-4" />
                {changingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
              </button>
            </>
          ) : (
            <>
              <h2 className="mb-5 text-4xl font-bold text-slate-900">Giao diện</h2>
              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-base font-semibold text-slate-700">Ngôn ngữ</p>
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
                        Tiếng Việt
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
                        English
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-base font-semibold text-slate-700">Chủ đề</p>
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
                        Sáng
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
                        Tối
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

