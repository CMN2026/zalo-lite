import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/auth";
import { useSettings } from "../../contexts/settings";
import { changePassword } from "../../lib/auth";
import { getMe, updateAvatar, updateCover, updateMe, type ProfileUser } from "../../lib/users";

function getFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "request_failed";
  const labels: Record<string, string> = {
    missing_local_session: "Vui lòng đăng nhập lại.",
    invalid_or_expired_token: "Phiên đăng nhập hết hạn.",
    phone_already_used: "Số điện thoại này đã được sử dụng bởi tài khoản khác.",
    validation_error: "Kiểm tra lại thông tin đã nhập.",
    user_not_found: "Không tìm thấy tài khoản.",
    image_must_be_valid_url_or_image_data: "Ảnh không hợp lệ, vui lòng chọn lại.",
  };
  return labels[message] ?? "Đã xảy ra lỗi. Vui lòng thử lại.";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold uppercase text-slate-500 mb-1">{label}</Text>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const { user: authUser, logout } = useAuth();
  const { language, setLanguage, theme, setTheme } = useSettings();

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingCover, setSavingCover] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(3);

  const t =
    language === "en"
      ? {
          profile: "Profile",
          refresh: "Refresh",
          personalInfo: "Personal information",
          saveChanges: "Save changes",
          logout: "Sign out",
          logoutConfirm: "Do you want to sign out?",
          cancel: "Cancel",
          settings: "Settings",
          language: "Language",
          theme: "Theme",
          security: "Security",
          currentPassword: "Current password",
          newPassword: "New password",
          confirmPassword: "Confirm new password",
          changePassword: "Change password",
          changing: "Changing...",
          passwordChanged: "Password changed successfully",
          reloginIn: "You will be signed out in",
          seconds: "seconds",
          reloginHint: "Please sign in again to use a new token.",
        }
      : {
          profile: "Cá nhân",
          refresh: "Làm mới",
          personalInfo: "Thông tin cá nhân",
          saveChanges: "Lưu thay đổi",
          logout: "Đăng xuất",
          logoutConfirm: "Bạn có chắc muốn đăng xuất?",
          cancel: "Huỷ",
          settings: "Cài đặt",
          language: "Ngôn ngữ",
          theme: "Giao diện",
          security: "Bảo mật",
          currentPassword: "Mật khẩu hiện tại",
          newPassword: "Mật khẩu mới",
          confirmPassword: "Xác nhận mật khẩu mới",
          changePassword: "Đổi mật khẩu",
          changing: "Đang đổi...",
          passwordChanged: "Thay đổi mật khẩu thành công",
          reloginIn: "Bạn sẽ được đăng xuất sau",
          seconds: "giây",
          reloginHint: "Vui lòng đăng nhập lại để dùng token mới.",
        };

  const initials = useMemo(() => {
    const src = profile?.fullName || profile?.email || "U";
    return src.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }, [profile]);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const res = await getMe();
      setProfile(res.data);
      setFullName(res.data.fullName ?? "");
      setPhone(res.data.phone ?? "");
      setBio(res.data.bio ?? "");
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await updateMe({ fullName, phone, bio });
      setProfile(res.data);
      setMessage("Cập nhật hồ sơ thành công.");
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function pickAndUploadImage(kind: "avatar" | "cover") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Vui lòng cấp quyền truy cập thư viện ảnh.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64 || !asset.mimeType) {
      setError("Không thể đọc ảnh đã chọn.");
      return;
    }

    const limitBytes = kind === "avatar" ? 2 * 1024 * 1024 : 4 * 1024 * 1024;
    if (typeof asset.fileSize === "number" && asset.fileSize > limitBytes) {
      setError(
        kind === "avatar"
          ? "Ảnh đại diện phải <= 2MB."
          : "Ảnh bìa phải <= 4MB.",
      );
      return;
    }

    const imageDataUrl = `data:${asset.mimeType};base64,${asset.base64}`;
    setError("");
    setMessage("");
    try {
      if (kind === "avatar") {
        setSavingAvatar(true);
        const res = await updateAvatar(imageDataUrl);
        setProfile((current) =>
          current ? { ...current, avatarUrl: res.data.avatarUrl ?? null } : current,
        );
        setMessage("Đã cập nhật ảnh đại diện.");
      } else {
        setSavingCover(true);
        const res = await updateCover(imageDataUrl);
        setProfile((current) =>
          current ? { ...current, coverUrl: res.data.coverUrl ?? null } : current,
        );
        setMessage("Đã cập nhật ảnh bìa.");
      }
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setSavingAvatar(false);
      setSavingCover(false);
    }
  }

  function handleLogout() {
    Alert.alert(t.logout, t.logoutConfirm, [
      { text: t.cancel, style: "cancel" },
      { text: t.logout, style: "destructive", onPress: () => logout() },
    ]);
  }

  async function handleChangePassword() {
    setError("");
    setMessage("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(language === "en" ? "Please fill all password fields." : "Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    if (newPassword.length < 8) {
      setError(language === "en" ? "New password must be at least 8 characters." : "Mật khẩu mới cần tối thiểu 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(language === "en" ? "Password confirmation does not match." : "Mật khẩu xác nhận không khớp.");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLogoutCountdown(3);
      setCountdownVisible(true);
      const timer = setInterval(() => {
        setLogoutCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            void logout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      const code = err instanceof Error ? err.message : "request_failed";
      const map: Record<string, string> = language === "en"
        ? {
            current_password_invalid: "Current password is incorrect.",
            new_password_must_differ: "New password must be different from current password.",
            invalid_or_expired_token: "Session expired. Please sign in again.",
            validation_error: "Invalid data. Please check your input.",
          }
        : {
            current_password_invalid: "Mật khẩu hiện tại không đúng.",
            new_password_must_differ: "Mật khẩu mới phải khác mật khẩu hiện tại.",
            invalid_or_expired_token: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
            validation_error: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.",
          };
      setError(map[code] ?? (language === "en" ? "Unable to change password." : "Không thể đổi mật khẩu."));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-zalo-bg">
      <View className="bg-zalo-blue px-4 py-3 border-b border-zalo-blue flex-row items-center justify-between">
        <Text className="text-xl font-bold text-white">{t.profile}</Text>
        <TouchableOpacity onPress={loadProfile}>
          <Text className="text-blue-100 text-sm font-semibold">{t.refresh}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {/* Cover + Avatar Card */}
        <View className="bg-white mt-4 mx-4 rounded-2xl border border-slate-100 p-6 items-center shadow-sm">
          <View className="w-full relative">
            <View className="w-full h-28 rounded-xl overflow-hidden bg-slate-100">
              {profile?.coverUrl ? (
                <Image source={{ uri: profile.coverUrl }} className="w-full h-full" />
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => void pickAndUploadImage("cover")}
              disabled={savingCover}
              className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white border border-slate-200 items-center justify-center"
            >
              {savingCover ? (
                <ActivityIndicator size="small" color="#334155" />
              ) : (
                <MaterialIcons name="edit" size={16} color="#334155" />
              )}
            </TouchableOpacity>
          </View>

          <View className="-mt-10 relative">
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} className="w-24 h-24 rounded-full border-4 border-white bg-slate-200" style={{ shadowOpacity: 0.1 }} />
            ) : (
              <View className="w-24 h-24 rounded-full bg-blue-600 items-center justify-center border-4 border-white">
                <Text className="text-white text-3xl font-bold">{initials}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => void pickAndUploadImage("avatar")}
              disabled={savingAvatar}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-white border border-slate-200 items-center justify-center"
            >
              {savingAvatar ? (
                <ActivityIndicator size="small" color="#334155" />
              ) : (
                <MaterialIcons name="edit" size={14} color="#334155" />
              )}
            </TouchableOpacity>
          </View>
          <Text className="text-xl font-bold text-slate-800 mt-4">{profile?.fullName ?? authUser?.fullName}</Text>
          <Text className="text-sm text-slate-500 mt-1">{profile?.email ?? authUser?.email}</Text>
          <View className="flex-row gap-2 mt-3">
            <View className="bg-blue-50 px-3 py-1 rounded-full">
              <Text className="text-blue-700 text-xs font-semibold">{profile?.role ?? "USER"}</Text>
            </View>
            <View className="bg-slate-100 px-3 py-1 rounded-full">
              <Text className="text-slate-700 text-xs font-semibold">{profile?.plan ?? "FREE"}</Text>
            </View>
          </View>
        </View>

        {/* Feedback messages */}
        {error ? (
          <View className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}
        {message ? (
          <View className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <Text className="text-green-700 text-sm">{message}</Text>
          </View>
        ) : null}

        {/* Edit Form */}
        <View className="bg-white mt-4 mx-4 rounded-2xl border border-slate-100 p-5 shadow-sm">
          <Text className="font-bold text-slate-800 mb-4">{t.personalInfo}</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#2563EB" className="py-8" />
          ) : (
            <>
              <Field label="Họ và tên">
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800"
                />
              </Field>

              <Field label="Số điện thoại">
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800"
                />
              </Field>

              <Field label="Email">
                <TextInput
                  value={profile?.email ?? ""}
                  editable={false}
                  className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-500"
                />
              </Field>

              <Field label="Giới thiệu bản thân">
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={4}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800"
                  style={{ textAlignVertical: "top", minHeight: 100 }}
                />
              </Field>

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className={`bg-blue-600 py-3 rounded-xl items-center mt-2 ${saving ? "opacity-70" : ""}`}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">{t.saveChanges}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View className="bg-white mt-4 mx-4 rounded-2xl border border-slate-100 p-5 shadow-sm">
          <Text className="font-bold text-slate-800 mb-4">{t.settings}</Text>
          <Field label={t.language}>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setLanguage("vi")}
                className={`px-3 py-2 rounded-lg ${language === "vi" ? "bg-blue-600" : "bg-slate-100"}`}
              >
                <Text className={`${language === "vi" ? "text-white" : "text-slate-700"}`}>Tiếng Việt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLanguage("en")}
                className={`px-3 py-2 rounded-lg ${language === "en" ? "bg-blue-600" : "bg-slate-100"}`}
              >
                <Text className={`${language === "en" ? "text-white" : "text-slate-700"}`}>English</Text>
              </TouchableOpacity>
            </View>
          </Field>
          <Field label={t.theme}>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setTheme("light")}
                className={`px-3 py-2 rounded-lg ${theme === "light" ? "bg-blue-600" : "bg-slate-100"}`}
              >
                <Text className={`${theme === "light" ? "text-white" : "text-slate-700"}`}>{language === "en" ? "Light" : "Sáng"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTheme("dark")}
                className={`px-3 py-2 rounded-lg ${theme === "dark" ? "bg-blue-600" : "bg-slate-100"}`}
              >
                <Text className={`${theme === "dark" ? "text-white" : "text-slate-700"}`}>{language === "en" ? "Dark" : "Tối"}</Text>
              </TouchableOpacity>
            </View>
          </Field>
          <Text className="font-semibold text-slate-700 mb-3">{t.security}</Text>
          <Field label={t.currentPassword}>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800"
            />
          </Field>
          <Field label={t.newPassword}>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800"
            />
          </Field>
          <Field label={t.confirmPassword}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800"
            />
          </Field>
          <TouchableOpacity
            onPress={() => void handleChangePassword()}
            disabled={changingPassword}
            className={`bg-blue-600 py-3 rounded-xl items-center mt-1 ${changingPassword ? "opacity-70" : ""}`}
          >
            {changingPassword ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">{t.changePassword}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View className="bg-white mt-4 mx-4 rounded-2xl border border-slate-100 shadow-sm mb-8">
          <TouchableOpacity onPress={handleLogout} className="p-4 items-center">
            <Text className="text-red-600 font-semibold text-base">{t.logout}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <AlertModal
        visible={countdownVisible}
        title={t.passwordChanged}
        description={`${t.reloginIn} ${logoutCountdown} ${t.seconds}.`}
        hint={t.reloginHint}
      />
    </SafeAreaView>
  );
}

function AlertModal({
  visible,
  title,
  description,
  hint,
}: {
  visible: boolean;
  title: string;
  description: string;
  hint: string;
}) {
  if (!visible) return null;
  return (
    <View className="absolute inset-0 bg-black/40 items-center justify-center px-6">
      <View className="w-full rounded-2xl bg-white p-5">
        <Text className="text-lg font-bold text-slate-900">{title}</Text>
        <Text className="text-sm text-slate-600 mt-2">{description}</Text>
        <Text className="text-xs text-slate-500 mt-1">{hint}</Text>
      </View>
    </View>
  );
}
