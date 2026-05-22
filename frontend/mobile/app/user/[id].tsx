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
import { authStorage } from "../../lib/auth";
import { useSocket } from "../../hooks/useSocket";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://3.27.239.232:3004";

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
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const token = await authStorage.getToken();
        const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch user profile");
        }
        
        const data = await response.json();
        setProfile(data.data);
      } catch {
        setError("Không thể tải thông tin người dùng.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [id]);

  const createDirectConversation = async () => {
    if (!id) return null;

    const token = await authStorage.getToken();
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
        setError("Không thể mở cuộc trò chuyện.");
      }
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
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
        setError("Không thể mở cuộc gọi.");
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
      setError("Không thể mở cuộc gọi.");
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
        <Stack.Screen options={{ title: "Lỗi" }} />
        <Text style={styles.errorText}>{error || "Người dùng không tồn tại"}</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Text style={styles.backButtonText}>Quay lại</Text>
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
              <Text style={styles.actionButtonText}>Gọi video</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={handleMessage}>
              <Feather name="message-circle" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Nhắn tin</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bio</Text>
              <Text style={styles.detailValue}>{profile.bio || "Chưa cập nhật"}</Text>
            </View>
            
            {profile.gender && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Giới tính</Text>
                <Text style={styles.detailValue}>
                  {profile.gender === "MALE" ? "Nam" : profile.gender === "FEMALE" ? "Nữ" : "Khác"}
                </Text>
              </View>
            )}
            
            {profile.dateOfBirth && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ngày sinh</Text>
                <Text style={styles.detailValue}>
                  {new Date(profile.dateOfBirth).toLocaleDateString("vi-VN")}
                </Text>
              </View>
            )}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Điện thoại</Text>
              <Text style={styles.detailValue}>
                {profile.phone ? "********" + profile.phone.slice(-3) : "Chưa cập nhật"}
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

