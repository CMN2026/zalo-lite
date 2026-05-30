import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { useAuth } from "../contexts/auth";
import { login as loginRequest, loginWithGoogle, saveAuthSession } from "../lib/auth";

WebBrowser.maybeCompleteAuthSession();

export default function LoginPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await loginRequest(identifier, password);
      console.log("✅ Login successful");
      await saveAuthSession(response.data.token, response.data.user);
      authLogin(response.data.user);
      router.replace("/");
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : "Đăng nhập thất bại. Vui lòng thử lại.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    if (!request) {
      setError("Google Sign-In chưa sẵn sàng. Vui lòng thử lại.");
      return;
    }

    setGoogleLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== "success") {
        return;
      }

      const idToken = result.params?.id_token;
      if (!idToken) {
        setError("Không nhận được Google token.");
        return;
      }

      const apiResponse = await loginWithGoogle({ idToken });
      await saveAuthSession(apiResponse.data.token, apiResponse.data.user);
      authLogin(apiResponse.data.user);
      router.replace("/");
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error && err.message
          ? err.message
          : "Đăng nhập Google thất bại.";
      const errorMap: Record<string, string> = {
        invalid_google_token: "Google token không hợp lệ.",
        google_email_not_verified: "Email Google chưa được xác minh.",
        google_auth_not_configured: "Máy chủ chưa cấu hình Google OAuth.",
        account_inactive: "Tài khoản đã bị vô hiệu hóa.",
        validation_error: "Dữ liệu đăng nhập Google không hợp lệ.",
        email_registered_use_password_login:
          "Email này đã đăng ký tài khoản. Vui lòng đăng nhập bằng mật khẩu.",
      };
      setError(errorMap[rawMessage] ?? "Đăng nhập Google thất bại.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 items-center justify-center px-4">
        <View className="items-center mb-8">
          <View className="w-16 h-16 bg-zalo-blue rounded-2xl flex items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">Z</Text>
          </View>
          <Text className="text-3xl font-bold text-slate-800 mb-2">Zalo Lite</Text>
          <Text className="text-slate-500">Đăng nhập tài khoản Zalo</Text>
        </View>

        <View className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
          <View className="space-y-4">
            <View>
              <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">SỐ ĐIỆN THOẠI HOẶC EMAIL</Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="Số điện thoại hoặc email"
                className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                autoCapitalize="none"
              />
            </View>

            <View className="mt-4">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">MẬT KHẨU</Text>
                <TouchableOpacity onPress={() => router.push("/forgot-password")}>
                  <Text className="text-xs text-zalo-blue font-semibold">Quên mật khẩu?</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
              />
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 px-4 py-2 rounded-lg mt-4">
                <Text className="text-red-600 text-sm">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              className={`w-full py-3 rounded-lg bg-zalo-blue items-center justify-center flex-row mt-6 ${loading ? 'opacity-60' : ''}`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" className="mr-2" />
              ) : null}
              <Text className="text-white font-semibold">{loading ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP"}</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-slate-200" />
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={googleLoading || !request}
              className={`flex-1 border border-slate-300 rounded-lg py-2 items-center justify-center flex-row gap-2 ${googleLoading || !request ? "opacity-60" : ""}`}
            >
              {googleLoading ? <ActivityIndicator size="small" color="#EA4335" /> : null}
              <FontAwesome name="google" size={14} color="#EA4335" />
              <Text className="text-sm font-semibold text-slate-700">
                {googleLoading ? "Đang xử lý..." : "Google"}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-6">
            <Text className="text-sm text-slate-600">Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text className="text-zalo-blue font-semibold text-sm">Đăng ký</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text className="text-xs text-slate-400 mt-8">© 2024 Zalo Lite. All rights reserved.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
