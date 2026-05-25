import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { register } from "../lib/auth";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");

    if (!fullName.trim() || !email.trim() || !password) {
      setError("Vui lòng nhập đầy đủ họ tên, email và mật khẩu");
      return;
    }

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    if (phone && (phone.trim().length < 8 || phone.trim().length > 20)) {
      setError("Số điện thoại phải có từ 8 đến 20 ký tự");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);

    try {
      const response = await register({
        fullName,
        email,
        phone: phone || undefined,
        password,
        avatarUrl: undefined,
      });
      router.push({
        pathname: "/register-verify",
        params: {
          session: response.data.verificationSessionId,
          email: response.data.email,
          expiresAt: response.data.expiresAt,
        },
      } as any);
    } catch (err) {
      const authError = err as Error & { errors?: Array<{ field: string; message: string }> };

      if (authError.message === "email_already_registered") {
        setError("Email này đã được sử dụng");
      } else if (authError.message === "phone_already_used") {
        setError("Số điện thoại này đã được sử dụng");
      } else if (authError.message === "email_service_not_configured") {
        setError("Hệ thống email chưa được cấu hình. Vui lòng liên hệ quản trị viên.");
      } else if (authError.message === "validation_error") {
        const firstError = authError.errors?.[0];
        if (firstError?.field === "password") {
          setError("Mật khẩu phải có từ 8 đến 72 ký tự");
        } else if (firstError?.field === "email") {
          setError("Email không đúng định dạng");
        } else if (firstError?.field === "fullName") {
          setError("Họ tên phải có từ 2 đến 100 ký tự");
        } else if (firstError?.field === "phone") {
          setError("Số điện thoại phải có từ 8 đến 20 ký tự");
        } else {
          setError("Dữ liệu không hợp lệ, vui lòng kiểm tra lại thông tin");
        }
      } else {
        setError("Không thể đăng ký. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View className="items-center mb-6 mt-8">
            <View className="w-16 h-16 bg-zalo-blue rounded-2xl flex items-center justify-center mb-4">
              <Text className="text-white text-3xl font-bold">Z</Text>
            </View>
            <Text className="text-2xl font-bold text-slate-800">Zalo Lite</Text>
            <Text className="text-sm text-slate-500">Tạo tài khoản Zalo</Text>
          </View>

          <View className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 mb-8">
            <View className="space-y-4">
              <View>
                <Text className="text-xs font-semibold text-slate-500 uppercase">HỌ VÀ TÊN</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="John Doe"
                  className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                />
              </View>

              <View className="mt-4">
                <Text className="text-xs font-semibold text-slate-500 uppercase">ĐỊA CHỈ EMAIL</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                />
              </View>

              <View className="mt-4">
                <Text className="text-xs font-semibold text-slate-500 uppercase">SỐ ĐIỆN THOẠI</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0911222333"
                  keyboardType="phone-pad"
                  className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                />
              </View>

              <View className="mt-4">
                <Text className="text-xs font-semibold text-slate-500 uppercase">MẬT KHẨU</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                />
              </View>

              <View className="mt-4">
                <Text className="text-xs font-semibold text-slate-500 uppercase">XÁC NHẬN MẬT KHẨU</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                />
              </View>

              {error ? (
                <View className="bg-red-50 border border-red-200 px-4 py-2 rounded-lg mt-4">
                  <Text className="text-red-600 text-sm text-center">{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                className={`w-full py-3 rounded-lg bg-zalo-blue items-center justify-center flex-row mt-6 ${loading ? 'opacity-70' : ''}`}
              >
                {loading ? <ActivityIndicator color="#fff" className="mr-2" /> : null}
                <Text className="text-white font-semibold">{loading ? "ĐANG TẠO..." : "TẠO TÀI KHOẢN"}</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-slate-500">Đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text className="text-zalo-blue font-semibold text-sm">Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <Text className="text-xs text-slate-400 mt-auto">© 2024 Zalo Lite. All rights reserved.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
