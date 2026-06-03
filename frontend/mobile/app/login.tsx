import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { useAuth } from "../contexts/auth";
import { useSettings } from "../contexts/settings";
import { login as loginRequest, loginWithGoogle, saveAuthSession } from "../lib/auth";

WebBrowser.maybeCompleteAuthSession();

export default function LoginPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const { language } = useSettings();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleAndroidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? "";
  const googleIosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";
  const googleWebClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
  const isGoogleConfigured = Boolean(googleAndroidClientId);
  const t =
    language === "en"
      ? {
          loginFailed: "Login failed. Please try again.",
          appSubtitle: "Sign in to your Zalo account",
          identifierLabel: "PHONE NUMBER OR EMAIL",
          identifierPlaceholder: "Phone number or email",
          passwordLabel: "PASSWORD",
          forgotPassword: "Forgot password?",
          loading: "SIGNING IN...",
          login: "SIGN IN",
          googleLoading: "Processing...",
          noAccount: "Don't have an account? ",
          register: "Register",
          googleNotConfigured: "Google Sign-In is not configured on Android.",
          googleNotReady: "Google Sign-In is not ready. Please try again.",
          missingGoogleToken: "Google token was not returned.",
          googleFailed: "Google sign-in failed.",
          copyright: "© 2024 Zalo Lite. All rights reserved.",
          errorMap: {
            invalid_credentials: "Incorrect phone number, email, or password.",
            invalid_or_expired_token: "Your session has expired. Please sign in again.",
            gateway_internal_error: "The login server is temporarily unavailable. Please try again later.",
            internal_server_error: "The login server encountered an error. Please try again later.",
            service_unavailable: "The login service is currently unavailable. Please try again later.",
          } satisfies Record<string, string>,
        }
      : {
          loginFailed: "Đăng nhập thất bại. Vui lòng thử lại.",
          appSubtitle: "Đăng nhập tài khoản Zalo",
          identifierLabel: "SỐ ĐIỆN THOẠI HOẶC EMAIL",
          identifierPlaceholder: "Số điện thoại hoặc email",
          passwordLabel: "MẬT KHẨU",
          forgotPassword: "Quên mật khẩu?",
          loading: "ĐANG ĐĂNG NHẬP...",
          login: "ĐĂNG NHẬP",
          googleLoading: "Đang xử lý...",
          noAccount: "Chưa có tài khoản? ",
          register: "Đăng ký",
          googleNotConfigured: "Ứng dụng chưa cấu hình Google Sign-In trên Android.",
          googleNotReady: "Google Sign-In chưa sẵn sàng. Vui lòng thử lại.",
          missingGoogleToken: "Không nhận được Google token.",
          googleFailed: "Đăng nhập Google thất bại.",
          copyright: "© 2024 Zalo Lite. All rights reserved.",
          errorMap: {
            invalid_credentials: "Số điện thoại, email hoặc mật khẩu không đúng.",
            invalid_or_expired_token: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
            gateway_internal_error: "Máy chủ đăng nhập đang gặp sự cố. Vui lòng thử lại sau.",
            internal_server_error: "Dịch vụ đăng nhập đang gặp lỗi. Vui lòng thử lại sau.",
            service_unavailable: "Dịch vụ đăng nhập tạm thời không khả dụng. Vui lòng thử lại sau.",
          } satisfies Record<string, string>,
        };

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    // Prevent runtime crash when env vars are missing in production builds.
    androidClientId: googleAndroidClientId || "missing-android-client-id",
    iosClientId: googleIosClientId || undefined,
    webClientId: googleWebClientId || undefined,
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
      const message = err instanceof Error && err.message ? err.message : "request_failed";
      setError(t.errorMap[message] ?? t.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    if (!isGoogleConfigured) {
      setError(t.googleNotConfigured);
      return;
    }
    if (!request) {
      setError(t.googleNotReady);
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
        setError(t.missingGoogleToken);
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
      setError(errorMap[rawMessage] ?? t.googleFailed);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 items-center justify-center px-4">
        <View className="items-center mb-8">
          <Image
            source={require("../assets/images/icon.png")}
            style={{ width: 64, height: 64, marginBottom: 16, borderRadius: 16 }}
            resizeMode="contain"
          />
          <Text className="text-3xl font-bold text-slate-800 mb-2">Zalo Lite</Text>
          <Text className="text-slate-500">{t.appSubtitle}</Text>
        </View>

        <View className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
          <View className="space-y-4">
            <View>
              <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">{t.identifierLabel}</Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder={t.identifierPlaceholder}
                className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                autoCapitalize="none"
              />
            </View>

            <View className="mt-4">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">{t.passwordLabel}</Text>
                <TouchableOpacity onPress={() => router.push("/forgot-password")}>
                  <Text className="text-xs text-zalo-blue font-semibold">{t.forgotPassword}</Text>
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
              <Text className="text-white font-semibold">{loading ? t.loading : t.login}</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-slate-200" />
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={googleLoading || !request || !isGoogleConfigured}
              className={`flex-1 border border-slate-300 rounded-lg py-2 items-center justify-center flex-row gap-2 ${googleLoading || !request || !isGoogleConfigured ? "opacity-60" : ""}`}
            >
              {googleLoading ? <ActivityIndicator size="small" color="#EA4335" /> : null}
              <FontAwesome name="google" size={14} color="#EA4335" />
              <Text className="text-sm font-semibold text-slate-700">
                {googleLoading ? t.googleLoading : "Google"}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-6">
            <Text className="text-sm text-slate-600">{t.noAccount}</Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text className="text-zalo-blue font-semibold text-sm">{t.register}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text className="text-xs text-slate-400 mt-8">{t.copyright}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
