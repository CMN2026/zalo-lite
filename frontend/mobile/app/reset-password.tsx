import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { resetPassword } from "../lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [tokenInput, setTokenInput] = useState("");
  const token = typeof params.token === "string" ? params.token : tokenInput.trim();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (!token) {
      setError("Thiếu token reset mật khẩu.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, newPassword });
      setSuccess("Đặt lại mật khẩu thành công.");
      setTimeout(() => router.replace("/login"), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "request_failed";
      setError(
        message === "reset_token_invalid_or_expired"
          ? "Link reset không hợp lệ hoặc đã hết hạn (5 phút)."
          : "Không thể đặt lại mật khẩu.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 items-center justify-center px-4">
        <View className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
          <Text className="text-2xl font-bold text-slate-800 text-center">Đặt lại mật khẩu</Text>
          <Text className="text-slate-500 text-center mt-2">Nhập mật khẩu mới của bạn.</Text>

          {typeof params.token !== "string" ? (
            <View className="mt-4">
              <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">RESET TOKEN</Text>
              <TextInput
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder="Dán token từ link email"
                autoCapitalize="none"
                className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
              />
            </View>
          ) : null}

          <View className="mt-4">
            <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">MẬT KHẨU MỚI</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
            />
          </View>

          <View className="mt-4">
            <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">XÁC NHẬN MẬT KHẨU MỚI</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
            />
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-200 px-4 py-2 rounded-lg mt-4">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View className="bg-green-50 border border-green-200 px-4 py-2 rounded-lg mt-4">
              <Text className="text-green-700 text-sm">{success}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className={`w-full py-3 rounded-lg bg-zalo-blue items-center justify-center flex-row mt-6 ${loading ? "opacity-60" : ""}`}
          >
            {loading ? <ActivityIndicator color="#fff" className="mr-2" /> : null}
            <Text className="text-white font-semibold">XÁC NHẬN</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

