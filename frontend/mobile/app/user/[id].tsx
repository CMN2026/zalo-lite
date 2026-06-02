import { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAuthToken } from "../../lib/auth";
import { useSettings } from "../../contexts/settings";
import { useSocket } from "../../hooks/useSocket";
import { formatLocaleDate } from "../../lib/i18n";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://32.236.47.127:3004";

interface UserProfile {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { emit } = useSocket();
  const { language } = useSettings();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const t =
    language === "en"
      ? {
          title: "Error",
          fetchFailed: "Unable to load user information.",
          missingUser: "User does not exist",
          back: "Go back",
          openChatFailed: "Unable to open the conversation.",
          connectFailed: "Unable to connect. Please try again.",
          callFailed: "Unable to start the call.",
          videoCall: "Video call",
          message: "Message",
          personalInfo: "Personal information",
          bio: "Bio",
          gender: "Gender",
          male: "Male",
          female: "Female",
          other: "Other",
          birthday: "Birthday",
          phone: "Phone",
          notUpdated: "Not updated",
        }
      : {
          title: "Lỗi",
          fetchFailed: "Không thể tải thông tin người dùng.",
          missingUser: "Người dùng không tồn tại",
          back: "Quay lại",
          openChatFailed: "Không thể mở cuộc trò chuyện.",
          connectFailed: "Không thể kết nối. Vui lòng thử lại.",
          callFailed: "Không thể mở cuộc gọi.",
          videoCall: "Gọi video",
          message: "Nhắn tin",
          personalInfo: "Thông tin cá nhân",
          bio: "Bio",
          gender: "Giới tính",
          male: "Nam",
          female: "Nữ",
          other: "Khác",
          birthday: "Ngày sinh",
          phone: "Điện thoại",
          notUpdated: "Chưa cập nhật",
        };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const token = await getAuthToken();
        const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
          headers: {
            Authorization: `Bearer ${token ?? ""}`
          }
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch user profile");
        }
        
        const data = await response.json();
        setProfile(data.data);
      } catch {
        setError(t.fetchFailed);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [id]);

  const createDirectConversation = async () => {
    if (!id) return null;

    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/conversations/direct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
      body: JSON.stringify({ userId: id }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.data?.id ?? data.id ?? null;
  };

  const handleMessage = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const conversationId = await createDirectConversation();

      if (conversationId) {
        router.navigate({
          pathname: "/",
          params: {
            openConversationId: conversationId,
            openConversationNonce: Date.now().toString(),
          },
        });
      } else {
        setError(t.openChatFailed);
      }
    } catch {
      setError(t.connectFailed);
    } finally {
      setLoading(false);
    }
  };

  const openVideoCall = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const conversationId = await createDirectConversation();

      if (!conversationId) {
        setError(t.callFailed);
        return;
      }

      const callId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      emit("call:initiate", {
        call_id: callId,
        conversation_id: conversationId,
        call_type: "direct",
      });

      router.push({
        pathname: "/webcall",
        params: {
          callId,
          incoming: "0",
          conversationId,
          conversationName: profile?.fullName ?? "Cuộc gọi",
          callType: "direct",
        },
      });
    } catch {
      setError(t.callFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/friends");
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0068FF" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: t.title }} />
        <Text style={styles.errorText}>{error || t.missingUser}</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Text style={styles.backButtonText}>{t.back}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView bounces={false} style={styles.scrollView}>
        <View style={styles.header}>
          {profile.coverUrl ? (
            <Image source={{ uri: profile.coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          
          <SafeAreaView style={[styles.safeAreaHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity 
              style={styles.headerBackButton} 
              onPress={handleGoBack}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.fullName)}&background=random` }} 
              style={styles.avatarImage} 
            />
          </View>
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.nameText}>{profile.fullName}</Text>
          
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={openVideoCall}>
              <Feather name="video" size={20} color="#1E293B" />
              <Text style={styles.actionButtonText}>{t.videoCall}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={handleMessage}>
              <Feather name="message-circle" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>{t.message}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>{t.personalInfo}</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t.bio}</Text>
              <Text style={styles.detailValue}>{profile.bio || t.notUpdated}</Text>
            </View>
            
            {profile.gender && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t.gender}</Text>
                <Text style={styles.detailValue}>
                  {profile.gender === "MALE" ? t.male : profile.gender === "FEMALE" ? t.female : t.other}
                </Text>
              </View>
            )}
            
            {profile.dateOfBirth && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t.birthday}</Text>
                <Text style={styles.detailValue}>
                  {formatLocaleDate(profile.dateOfBirth, language)}
                </Text>
              </View>
            )}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t.phone}</Text>
              <Text style={styles.detailValue}>
                {profile.phone ? "********" + profile.phone.slice(-3) : t.notUpdated}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    height: 240,
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#0068FF", // Zalo blue
  },
  safeAreaHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBackButton: {
    marginTop: 10,
    marginLeft: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarContainer: {
    position: "absolute",
    bottom: -40,
    alignSelf: "center",
    backgroundColor: "#fff",
    borderRadius: 60,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileInfo: {
    paddingTop: 50,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  nameText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 20,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: "#0068FF",
  },
  actionButtonText: {
    fontWeight: "600",
    color: "#1E293B",
  },
  primaryButtonText: {
    fontWeight: "600",
    color: "#fff",
  },
  detailsCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  detailRow: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  detailLabel: {
    width: 100,
    fontSize: 14,
    color: "#64748B",
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: "#0068FF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
  }
});
