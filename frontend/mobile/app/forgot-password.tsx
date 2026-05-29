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
import { useRouter } from "expo-router";
import { requestPasswordReset } from "../lib/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim());
      setSuccess(
        `Đã gửi link reset đến ${res.data.email}. Link hết hạn sau ${res.data.expiresInMinutes} phút.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "request_failed";
      setError(
        message === "email_not_found"
          ? "Email này chưa được đăng ký tài khoản."
          : "Không thể gửi yêu cầu reset mật khẩu.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 items-center justify-center px-4">
        <View className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
          <Text className="text-2xl font-bold text-slate-800 text-center">Quên mật khẩu</Text>
          <Text className="text-slate-500 text-center mt-2">
            Nhập email để nhận link đặt lại mật khẩu.
          </Text>

          <View className="mt-6">
            <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
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
            <Text className="text-white font-semibold">YÊU CẦU RESET MẬT KHẨU</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} className="items-center mt-4">
            <Text className="text-zalo-blue font-semibold">Quay lại đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

