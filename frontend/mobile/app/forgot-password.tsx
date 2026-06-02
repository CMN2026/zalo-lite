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
import { useSettings } from "../contexts/settings";
import { requestPasswordReset } from "../lib/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { language } = useSettings();
  const t =
    language === "en"
      ? {
          title: "Forgot password",
          subtitle: "Enter your email to receive a password reset link.",
          email: "EMAIL",
          submit: "REQUEST PASSWORD RESET",
          back: "Back to sign in",
          emailNotFound: "This email is not registered.",
          failed: "Unable to send password reset request.",
          success: (targetEmail: string, minutes: number) =>
            `A reset link was sent to ${targetEmail}. The link expires in ${minutes} minutes.`,
        }
      : {
          title: "Quên mật khẩu",
          subtitle: "Nhập email để nhận link đặt lại mật khẩu.",
          email: "EMAIL",
          submit: "YÊU CẦU RESET MẬT KHẨU",
          back: "Quay lại đăng nhập",
          emailNotFound: "Email này chưa được đăng ký tài khoản.",
          failed: "Không thể gửi yêu cầu reset mật khẩu.",
          success: (targetEmail: string, minutes: number) =>
            `Đã gửi link reset đến ${targetEmail}. Link hết hạn sau ${minutes} phút.`,
        };
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
      setSuccess(t.success(res.data.email, res.data.expiresInMinutes));
    } catch (err) {
      const message = err instanceof Error ? err.message : "request_failed";
      setError(
        message === "email_not_found"
          ? t.emailNotFound
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

          <View className="mt-6">
            <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">{t.email}</Text>
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
            <Text className="text-white font-semibold">{t.submit}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} className="items-center mt-4">
            <Text className="text-zalo-blue font-semibold">{t.back}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
