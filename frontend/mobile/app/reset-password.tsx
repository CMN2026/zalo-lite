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
import { useSettings } from "../contexts/settings";
import { resetPassword } from "../lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { language } = useSettings();
  const params = useLocalSearchParams<{ token?: string }>();
  const t =
    language === "en"
      ? {
          title: "Reset password",
          subtitle: "Enter your new password.",
          tokenLabel: "RESET TOKEN",
          tokenPlaceholder: "Paste the token from the email link",
          newPassword: "NEW PASSWORD",
          confirmPassword: "CONFIRM NEW PASSWORD",
          missingToken: "Missing password reset token.",
          minPassword: "New password must be at least 8 characters.",
          mismatch: "Password confirmation does not match.",
          success: "Password reset successful.",
          invalidLink: "Reset link is invalid or expired (5 minutes).",
          failed: "Unable to reset password.",
          submit: "CONFIRM",
        }
      : {
          title: "Đặt lại mật khẩu",
          subtitle: "Nhập mật khẩu mới của bạn.",
          tokenLabel: "RESET TOKEN",
          tokenPlaceholder: "Dán token từ link email",
          newPassword: "MẬT KHẨU MỚI",
          confirmPassword: "XÁC NHẬN MẬT KHẨU MỚI",
          missingToken: "Thiếu token reset mật khẩu.",
          minPassword: "Mật khẩu mới phải có ít nhất 8 ký tự.",
          mismatch: "Mật khẩu xác nhận không khớp.",
          success: "Đặt lại mật khẩu thành công.",
          invalidLink: "Link reset không hợp lệ hoặc đã hết hạn (5 phút).",
          failed: "Không thể đặt lại mật khẩu.",
          submit: "XÁC NHẬN",
        };
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
      setError(t.missingToken);
      return;
    }
    if (newPassword.length < 8) {
      setError(t.minPassword);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.mismatch);
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, newPassword });
      setSuccess(t.success);
      setTimeout(() => router.replace("/login"), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "request_failed";
      setError(
        message === "reset_token_invalid_or_expired"
          ? t.invalidLink
          : t.failed,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 items-center justify-center px-4">
        <View className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
          <Text className="text-2xl font-bold text-slate-800 text-center">{t.title}</Text>
          <Text className="text-slate-500 text-center mt-2">{t.subtitle}</Text>

          {typeof params.token !== "string" ? (
            <View className="mt-4">
              <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">{t.tokenLabel}</Text>
              <TextInput
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder={t.tokenPlaceholder}
                autoCapitalize="none"
                className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
              />
            </View>
          ) : null}

          <View className="mt-4">
            <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">{t.newPassword}</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
            />
          </View>

          <View className="mt-4">
            <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">{t.confirmPassword}</Text>
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
            <Text className="text-white font-semibold">{t.submit}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
