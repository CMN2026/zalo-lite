import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/auth";
import { login as loginRequest, saveAuthSession } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 items-center justify-center px-4">
        <View className="items-center mb-8">
          <View className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Text className="text-white text-2xl font-bold">+</Text>
          </View>
          <Text className="text-3xl font-bold text-slate-800 mb-2">Zalo Lite</Text>
          <Text className="text-slate-500">Sign In</Text>
        </View>

        <View className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
          <View className="space-y-4">
            <View>
              <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">EMAIL ADDRESS OR PHONE NUMBER</Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="name@example.com"
                className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                autoCapitalize="none"
              />
            </View>

            <View className="mt-4">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">PASSWORD</Text>
                <TouchableOpacity>
                  <Text className="text-xs text-blue-600 font-semibold">Forgot?</Text>
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
              className={`w-full py-3 rounded-lg bg-blue-600 items-center justify-center flex-row mt-6 ${loading ? 'opacity-60' : ''}`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" className="mr-2" />
              ) : null}
              <Text className="text-white font-semibold">{loading ? "SIGNING IN..." : "SIGN IN"}</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-slate-200" />
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity className="flex-1 border border-slate-300 rounded-lg py-2 items-center">
              <Text className="text-sm font-semibold text-slate-700">Google</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 border border-slate-300 rounded-lg py-2 items-center">
              <Text className="text-sm font-semibold text-slate-700">Facebook</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-6">
            <Text className="text-sm text-slate-600">Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text className="text-blue-600 font-semibold text-sm">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text className="text-xs text-slate-400 mt-8">© 2024 Zalo Lite. All rights reserved.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
