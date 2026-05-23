import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { View } from "react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? "light"].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
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
          title: "Tin nhắn",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="message.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Danh bạ",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="person.2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          title: "Khám phá", // Renamed from Chatbot visually
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="brain.head.profile" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Cá nhân",
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
