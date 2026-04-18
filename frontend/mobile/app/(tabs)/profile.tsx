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
import { useAuth } from "../../contexts/auth";
import { getMe, updateMe, type ProfileUser } from "../../lib/users";

function getFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "request_failed";
  const labels: Record<string, string> = {
    missing_local_session: "Vui lòng đăng nhập lại.",
    invalid_or_expired_token: "Phiên đăng nhập hết hạn.",
    phone_already_used: "Số điện thoại này đã được sử dụng bởi tài khoản khác.",
    validation_error: "Kiểm tra lại thông tin đã nhập.",
    user_not_found: "Không tìm thấy tài khoản.",
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

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  function handleLogout() {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Huỷ", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: () => logout() },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <View className="bg-white px-4 py-3 border-b border-slate-200 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-slate-800">Cá nhân</Text>
        <TouchableOpacity onPress={loadProfile}>
          <Text className="text-blue-600 text-sm font-semibold">Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {/* Avatar Card */}
        <View className="bg-white mt-4 mx-4 rounded-2xl border border-slate-100 p-6 items-center shadow-sm">
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} className="w-24 h-24 rounded-full border-4 border-white bg-slate-200" style={{ shadowOpacity: 0.1 }} />
          ) : (
            <View className="w-24 h-24 rounded-full bg-blue-600 items-center justify-center">
              <Text className="text-white text-3xl font-bold">{initials}</Text>
            </View>
          )}
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
          <Text className="font-bold text-slate-800 mb-4">Thông tin cá nhân</Text>

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
                  <Text className="text-white font-semibold">Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Logout */}
        <View className="bg-white mt-4 mx-4 rounded-2xl border border-slate-100 shadow-sm mb-8">
          <TouchableOpacity onPress={handleLogout} className="p-4 items-center">
            <Text className="text-red-600 font-semibold text-base">Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
