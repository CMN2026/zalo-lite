import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { useSettings } from "../contexts/settings";
import { register } from "../lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { language } = useSettings();
  const t =
    language === "en"
      ? {
          subtitle: "Create your Zalo account",
          fullName: "FULL NAME",
          email: "EMAIL ADDRESS",
          phone: "PHONE NUMBER",
          password: "PASSWORD",
          confirmPassword: "CONFIRM PASSWORD",
          creating: "CREATING...",
          create: "CREATE ACCOUNT",
          hasAccount: "Already have an account? ",
          login: "Sign in",
          copyright: "© 2024 Zalo Lite. All rights reserved.",
          required: "Please enter your full name, email, and password",
          minPassword: "Password must be at least 8 characters",
          invalidPhone: "Phone number must be between 8 and 20 characters",
          mismatch: "Password confirmation does not match",
          emailUsed: "This email is already in use",
          phoneUsed: "This phone number is already in use",
          emailNotConfigured: "Email service is not configured. Please contact the administrator.",
          passwordLength: "Password must be between 8 and 72 characters",
          invalidEmail: "Invalid email format",
          invalidFullName: "Full name must be between 2 and 100 characters",
          invalidData: "Invalid data. Please check your information",
          failed: "Unable to register. Please try again.",
        }
      : {
          subtitle: "Tạo tài khoản Zalo",
          fullName: "HỌ VÀ TÊN",
          email: "ĐỊA CHỈ EMAIL",
          phone: "SỐ ĐIỆN THOẠI",
          password: "MẬT KHẨU",
          confirmPassword: "XÁC NHẬN MẬT KHẨU",
          creating: "ĐANG TẠO...",
          create: "TẠO TÀI KHOẢN",
          hasAccount: "Đã có tài khoản? ",
          login: "Đăng nhập",
          copyright: "© 2024 Zalo Lite. All rights reserved.",
          required: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu",
          minPassword: "Mật khẩu phải có ít nhất 8 ký tự",
          invalidPhone: "Số điện thoại phải có từ 8 đến 20 ký tự",
          mismatch: "Mật khẩu xác nhận không khớp",
          emailUsed: "Email này đã được sử dụng",
          phoneUsed: "Số điện thoại này đã được sử dụng",
          emailNotConfigured: "Hệ thống email chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
          passwordLength: "Mật khẩu phải có từ 8 đến 72 ký tự",
          invalidEmail: "Email không đúng định dạng",
          invalidFullName: "Họ tên phải có từ 2 đến 100 ký tự",
          invalidData: "Dữ liệu không hợp lệ, vui lòng kiểm tra lại thông tin",
          failed: "Không thể đăng ký. Vui lòng thử lại.",
        };

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
      setError(t.required);
      return;
    }

    if (password.length < 8) {
      setError(t.minPassword);
      return;
    }

    if (phone && (phone.trim().length < 8 || phone.trim().length > 20)) {
      setError(t.invalidPhone);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.mismatch);
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
        setError(t.emailUsed);
      } else if (authError.message === "phone_already_used") {
        setError(t.phoneUsed);
      } else if (authError.message === "email_service_not_configured") {
        setError(t.emailNotConfigured);
      } else if (authError.message === "validation_error") {
        const firstError = authError.errors?.[0];
        if (firstError?.field === "password") {
          setError(t.passwordLength);
        } else if (firstError?.field === "email") {
          setError(t.invalidEmail);
        } else if (firstError?.field === "fullName") {
          setError(t.invalidFullName);
        } else if (firstError?.field === "phone") {
          setError(t.invalidPhone);
        } else {
          setError(t.invalidData);
        }
      } else {
        setError(t.failed);
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
            <Image
              source={require("../assets/images/icon.png")}
              style={{ width: 64, height: 64, marginBottom: 16, borderRadius: 16 }}
              resizeMode="contain"
            />
            <Text className="text-2xl font-bold text-slate-800">Zalo Lite</Text>
            <Text className="text-sm text-slate-500">{t.subtitle}</Text>
          </View>

          <View className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 mb-8">
            <View className="space-y-4">
              <View>
                <Text className="text-xs font-semibold text-slate-500 uppercase">{t.fullName}</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="John Doe"
                  className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                />
              </View>

              <View className="mt-4">
                <Text className="text-xs font-semibold text-slate-500 uppercase">{t.email}</Text>
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
                <Text className="text-xs font-semibold text-slate-500 uppercase">{t.phone}</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0911222333"
                  keyboardType="phone-pad"
                  className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                />
              </View>

              <View className="mt-4">
                <Text className="text-xs font-semibold text-slate-500 uppercase">{t.password}</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                />
              </View>

              <View className="mt-4">
                <Text className="text-xs font-semibold text-slate-500 uppercase">{t.confirmPassword}</Text>
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
                <Text className="text-white font-semibold">{loading ? t.creating : t.create}</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-slate-500">{t.hasAccount}</Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text className="text-zalo-blue font-semibold text-sm">{t.login}</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <Text className="text-xs text-slate-400 mt-auto">{t.copyright}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
