import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";

interface ChatMessage {
  id: string;
  content: string;
  type: "user" | "bot";
  timestamp: Date;
  status?: "sending" | "sent" | "error";
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  unread: number;
  avatar: string;
}

// Mock data
const mockConversations: Conversation[] = [
  {
    id: "1",
    title: "Support Bot",
    lastMessage: "How can I help you today?",
    timestamp: new Date(Date.now() - 3600000),
    unread: 0,
    avatar: "https://via.placeholder.com/40?text=Support",
  },
  {
    id: "2",
    title: "Sales Assistant",
    lastMessage: "Tell me about our products",
    timestamp: new Date(Date.now() - 7200000),
    unread: 2,
    avatar: "https://via.placeholder.com/40?text=Sales",
  },
  {
    id: "3",
    title: "FAQ Bot",
    lastMessage: "What would you like to know?",
    timestamp: new Date(Date.now() - 86400000),
    unread: 0,
    avatar: "https://via.placeholder.com/40?text=FAQ",
  },
];

const mockMessages: Record<string, ChatMessage[]> = {
  "1": [
    {
      id: "m1",
      content: "Hi! How can I help you today?",
      type: "bot",
      timestamp: new Date(Date.now() - 300000),
      status: "sent",
    },
    {
      id: "m2",
      content: "I have a question about my account",
      type: "user",
      timestamp: new Date(Date.now() - 240000),
      status: "sent",
    },
    {
      id: "m3",
      content:
        "Sure! I'd be happy to help. What's your question about your account?",
      type: "bot",
      timestamp: new Date(Date.now() - 200000),
      status: "sent",
    },
  ],
  "2": [
    {
      id: "m1",
      content: "Welcome! Which product would you like to learn about?",
      type: "bot",
      timestamp: new Date(Date.now() - 7200000),
      status: "sent",
    },
  ],
  "3": [
    {
      id: "m1",
      content: "Hello! What would you like to know?",
      type: "bot",
      timestamp: new Date(Date.now() - 86400000),
      status: "sent",
    },
  ],
};

interface ConversationListItemProps {
  conversation: Conversation;
  isActive: boolean;
  onPress: () => void;
}

const ConversationListItem = ({
  conversation,
  isActive,
  onPress,
}: ConversationListItemProps) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.conversationItem, isActive && styles.conversationItemActive]}
  >
    <Image
      source={{ uri: conversation.avatar }}
      style={styles.conversationAvatar}
    />
    <View style={styles.conversationContent}>
      <View style={styles.conversationHeader}>
        <Text style={styles.conversationTitle}>{conversation.title}</Text>
        <Text style={styles.conversationTime}>
          {conversation.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <Text style={styles.conversationMessage} numberOfLines={1}>
        {conversation.lastMessage}
      </Text>
    </View>
    {conversation.unread > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{conversation.unread}</Text>
      </View>
    )}
  </TouchableOpacity>
);

interface MessageItemProps {
  message: ChatMessage;
}

const MessageItem = ({ message }: MessageItemProps) => {
  const isUser = message.type === "user";

  return (
    <View
      style={[styles.messageContainer, isUser && styles.messageContainerUser]}
    >
      <View style={[styles.messageBubble, isUser && styles.messageBubbleUser]}>
        <Text style={[styles.messageText, isUser && styles.messageTextUser]}>
          {message.content}
        </Text>
        <Text style={[styles.messageTime, isUser && styles.messageTimeUser]}>
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
};

export default function ChatbotScreen() {
  const [activeChatId, setActiveChatId] = useState("1");
  const [messages, setMessages] = useState<ChatMessage[]>(
    mockMessages["1"] || [],
  );
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [showConversationList, setShowConversationList] = useState(false);

  const activeChat =
    mockConversations.find((c) => c.id === activeChatId) ||
    mockConversations[0];

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleConversationChange = (chatId: string) => {
    setActiveChatId(chatId);
    setMessages(mockMessages[chatId] || []);
    setInputValue("");
    setShowConversationList(false);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: `m${Date.now()}`,
      content: inputValue,
      type: "user",
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    setTimeout(() => {
      const botMessage: ChatMessage = {
        id: `m${Date.now() + 1}`,
        content: `I understand. You mentioned: "${userMessage.content}". I'm processing your request...`,
        type: "bot",
        timestamp: new Date(),
        status: "sent",
      };

      setMessages((prev) => [
        ...prev.map((m) =>
          m.id === userMessage.id ? { ...m, status: "sent" } : m,
        ),
        botMessage,
      ]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        {showConversationList ? (
          // Conversation List View
          <View style={styles.fullScreen}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>AI Chatbots</Text>
              <Text style={styles.headerSubtitle}>Your conversations</Text>
            </View>
            <FlatList
              data={mockConversations}
              renderItem={({ item }) => (
                <ConversationListItem
                  conversation={item}
                  isActive={item.id === activeChatId}
                  onPress={() => handleConversationChange(item.id)}
                />
              )}
              keyExtractor={(item) => item.id}
            />
          </View>
        ) : (
          // Chat View
          <View style={styles.fullScreen}>
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <TouchableOpacity
                onPress={() => setShowConversationList(true)}
                style={styles.chatHeaderButton}
              >
                <Image
                  source={{ uri: activeChat.avatar }}
                  style={styles.chatHeaderAvatar}
                />
                <View>
                  <Text style={styles.chatHeaderTitle}>{activeChat.title}</Text>
                  <Text style={styles.chatHeaderSubtitle}>Always online</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Image
                  source={{ uri: activeChat.avatar }}
                  style={styles.emptyStateImage}
                />
                <Text style={styles.emptyStateText}>No messages yet</Text>
              </View>
            ) : (
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                onContentSizeChange={() => scrollToBottom()}
              >
                {messages.map((message) => (
                  <MessageItem key={message.id} message={message} />
                ))}
                {isLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#0066FF" />
                  </View>
                )}
              </ScrollView>
            )}

            {/* Input Area */}
            <View style={styles.inputArea}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Type your message..."
                  placeholderTextColor="#999"
                  value={inputValue}
                  onChangeText={setInputValue}
                  onSubmitEditing={handleSendMessage}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  style={[
                    styles.sendButton,
                    (!inputValue.trim() || isLoading) &&
                      styles.sendButtonDisabled,
                  ]}
                >
                  <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  fullScreen: {
    flex: 1,
  },
  // Conversation List Styles
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
  },
  conversationItem: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  conversationItemActive: {
    backgroundColor: "#EFF6FF",
    borderLeftWidth: 4,
    borderLeftColor: "#0066FF",
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  conversationTime: {
    fontSize: 12,
    color: "#94A3B8",
  },
  conversationMessage: {
    fontSize: 12,
    color: "#64748B",
  },
  badge: {
    backgroundColor: "#0066FF",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  // Chat Header Styles
  chatHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  chatHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  chatHeaderTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  chatHeaderSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  // Messages Styles
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  messageContainer: {
    marginVertical: 6,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  messageContainerUser: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "80%",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageBubbleUser: {
    backgroundColor: "#0066FF",
    borderColor: "#0066FF",
  },
  messageText: {
    fontSize: 14,
    color: "#1E293B",
  },
  messageTextUser: {
    color: "#FFFFFF",
  },
  messageTime: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  messageTimeUser: {
    color: "#D4E6F7",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    opacity: 0.3,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#94A3B8",
  },
  // Input Styles
  inputArea: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#1E293B",
  },
  sendButton: {
    backgroundColor: "#0066FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: "#CBD5E1",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
