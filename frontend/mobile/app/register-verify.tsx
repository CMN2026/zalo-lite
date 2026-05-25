import { useEffect, useMemo, useState } from "react";
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
import {
  resendRegisterCode,
  saveAuthSession,
  verifyRegisterCode,
} from "../lib/auth";
import { useAuth } from "../contexts/auth";

const MAX_ATTEMPTS = 3;
const RESEND_SECONDS = 60;

export default function RegisterVerifyPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    session?: string;
    email?: string;
    expiresAt?: string;
  }>();
  const { login } = useAuth();

  const sessionId = typeof params.session === "string" ? params.session : "";
  const email = typeof params.email === "string" ? params.email : "";
  const expiresAtParam = typeof params.expiresAt === "string" ? params.expiresAt : "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(RESEND_SECONDS);
  const [expiresAt, setExpiresAt] = useState(() => new Date(expiresAtParam));
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!sessionId || !email || Number.isNaN(expiresAt.getTime())) {
      router.replace("/register");
    }
  }, [email, expiresAt, router, sessionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setIsLocked(true);
        setError("Mã xác nhận đã hết hạn. Vui lòng đăng ký lại.");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const timeLeftLabel = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [secondsLeft]);

  const handleVerify = async () => {
    if (isLocked) return;

    setError("");
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Vui lòng nhập mã OTP gồm 6 chữ số");
      return;
    }

    setLoading(true);
    try {
      const response = await verifyRegisterCode({
        verificationSessionId: sessionId,
        code: code.trim(),
      });
      await saveAuthSession(response.data.token, response.data.user);
      login(response.data.user);
      router.replace("/");
    } catch (err) {
      const authError = err as Error;
      if (authError.message === "verification_code_invalid") {
        const nextAttempt = attemptCount + 1;
        setAttemptCount(nextAttempt);
        if (nextAttempt >= MAX_ATTEMPTS) {
          setIsLocked(true);
          setError("Bạn đã nhập sai OTP 3 lần. Vui lòng đăng ký lại.");
        } else {
          setError(`Mã OTP không đúng. Bạn còn ${MAX_ATTEMPTS - nextAttempt} lần thử.`);
        }
      } else if (
        authError.message === "verification_code_expired" ||
        authError.message === "verification_failed_max_attempts" ||
        authError.message === "verification_session_inactive"
      ) {
        setIsLocked(true);
        setError("Phiên xác nhận không còn hiệu lực. Vui lòng đăng ký lại.");
      } else {
        setError("Không thể xác nhận mã. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || isLocked) return;

    setError("");
    setResendLoading(true);
    try {
      const response = await resendRegisterCode(sessionId);
      setResendCountdown(RESEND_SECONDS);
      setCode("");
      setAttemptCount(0);
      setIsLocked(false);
      setExpiresAt(new Date(response.data.expiresAt));
    } catch (err) {
      const authError = err as Error;
      if (authError.message === "resend_too_soon") {
        setResendCountdown(RESEND_SECONDS);
      } else if (
        authError.message === "verification_code_expired" ||
        authError.message === "verification_failed_max_attempts" ||
        authError.message === "verification_session_inactive"
      ) {
        setIsLocked(true);
        setError("Phiên xác nhận không còn hiệu lực. Vui lòng đăng ký lại.");
      } else {
        setError("Không thể gửi lại mã. Vui lòng thử lại.");
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-100">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 items-center justify-center px-4">
        <View className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
          <Text className="text-2xl font-bold text-slate-800 text-center">Xác nhận email</Text>
          <Text className="text-sm text-slate-600 text-center mt-2">
            Mã OTP đã được gửi đến {email}
          </Text>
          <Text className="text-sm text-slate-500 text-center mt-1">
            Mã còn hiệu lực trong: {timeLeftLabel}
          </Text>

          <View className="mt-6">
            <Text className="text-xs font-bold text-slate-600 uppercase tracking-wide">MÃ OTP (6 SỐ)</Text>
            <TextInput
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              editable={!isLocked}
              className="w-full mt-2 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-center tracking-[6px]"
            />
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-200 px-4 py-2 rounded-lg mt-4">
              <Text className="text-red-600 text-sm text-center">{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleVerify}
            disabled={loading || isLocked}
            className={`w-full py-3 rounded-lg bg-zalo-blue items-center justify-center flex-row mt-6 ${loading || isLocked ? "opacity-60" : ""}`}
          >
            {loading ? <ActivityIndicator color="#fff" className="mr-2" /> : null}
            <Text className="text-white font-semibold">{loading ? "ĐANG XÁC NHẬN..." : "XÁC NHẬN MÃ"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResend}
            disabled={resendCountdown > 0 || resendLoading || isLocked}
            className={`w-full py-3 rounded-lg border border-slate-300 items-center justify-center mt-3 ${resendCountdown > 0 || resendLoading || isLocked ? "opacity-60" : ""}`}
          >
            <Text className="text-slate-700 font-semibold">
              {resendLoading
                ? "ĐANG GỬI LẠI..."
                : resendCountdown > 0
                  ? `Gửi lại mã (${resendCountdown}s)`
                  : "Gửi lại mã"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/register")}
            className="w-full py-3 rounded-lg items-center justify-center mt-3"
          >
            <Text className="text-zalo-blue font-semibold">Quay lại trang đăng ký</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
