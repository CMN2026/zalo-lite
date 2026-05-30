import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSettings } from "../../contexts/settings";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { language, theme } = useSettings();
  const scheme = theme === "dark" ? "dark" : (colorScheme ?? "light");

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[scheme].tint,
        tabBarInactiveTintColor: Colors[scheme].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: theme === "dark" ? "#111827" : "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: theme === "dark" ? "#334155" : "#E0E0E0",
          elevation: 0,
          shadowOpacity: 0,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        }
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            // Always return to conversation list when user taps the Messages tab.
            event.preventDefault();
            navigation.navigate("index", {
              showConversationListNonce: Date.now().toString(),
              openConversationId: undefined,
              openConversationNonce: undefined,
            });
          },
        })}
        options={{
          title: language === "en" ? "Messages" : "Tin nhắn",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="message.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="posts"
        options={{
          title: language === "en" ? "Posts" : "Bảng tin",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="newspaper.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: language === "en" ? "Contacts" : "Danh bạ",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="person.2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          title: language === "en" ? "Explore" : "Khám phá",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="brain.head.profile" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: language === "en" ? "Profile" : "Cá nhân",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="person.fill" color={color} />
          ),
        }}
      />
      {/* Hide the default explore tab if exists, but we can just define ones we need */}
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
