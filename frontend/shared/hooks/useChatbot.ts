import { useState, useCallback } from "react";

export interface ChatMessage {
  id: string;
  content: string;
  type: "user" | "bot";
  timestamp: Date;
  status?: "sending" | "sent" | "error";
  conversationId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  unread: number;
  avatar: string;
  messages?: ChatMessage[];
}

interface UseChatbotReturn {
  messages: ChatMessage[];
  conversations: Conversation[];
  activeChatId: string;
  isLoading: boolean;
  setActiveChatId: (id: string) => void;
  sendMessage: (content: string) => Promise<void>;
  addMessage: (message: ChatMessage) => void;
  switchConversation: (conversationId: string) => void;
  clearMessages: () => void;
}

/**
 * Custom hook for managing chatbot conversations
 * Can be used in both web and mobile components
 */
export function useChatbot(
  initialConversations: Conversation[],
  initialMessages: Record<string, ChatMessage[]> = {},
): UseChatbotReturn {
  const [activeChatId, setActiveChatId] = useState(
    initialConversations[0]?.id || "",
  );
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages[activeChatId] || [],
  );
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [isLoading, setIsLoading] = useState(false);

  const switchConversation = useCallback(
    (conversationId: string) => {
      setActiveChatId(conversationId);
      setMessages(initialMessages[conversationId] || []);
    },
    [initialMessages],
  );

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: ChatMessage = {
        id: `m${Date.now()}`,
        content,
        type: "user",
        timestamp: new Date(),
        status: "sending",
        conversationId: activeChatId,
      };

      addMessage(userMessage);
      setIsLoading(true);

      try {
        // Simulate API call to chatbot-service
        // In production, this would call: POST /chatbot/messages
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Update user message status
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage.id ? { ...m, status: "sent" } : m,
          ),
        );

        // Add bot response
        const botMessage: ChatMessage = {
          id: `m${Date.now() + 1}`,
          content: `I understand. You mentioned: "${content}". I'm processing your request...`,
          type: "bot",
          timestamp: new Date(),
          status: "sent",
          conversationId: activeChatId,
        };

        addMessage(botMessage);

        // Update conversation last message
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeChatId
              ? {
                  ...conv,
                  lastMessage: content,
                  timestamp: new Date(),
                }
              : conv,
          ),
        );
      } catch (error) {
        console.error("Failed to send message:", error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage.id ? { ...m, status: "error" } : m,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeChatId, addMessage],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    conversations,
    activeChatId,
    isLoading,
    setActiveChatId,
    sendMessage,
    addMessage,
    switchConversation,
    clearMessages,
  };
}
