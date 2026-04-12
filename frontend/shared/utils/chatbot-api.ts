/**
 * Chatbot API utilities
 * Handles communication with chatbot-service
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

export interface SendMessageRequest {
  message: string;
  conversationId?: string;
}

export interface SendMessageResponse {
  id: string;
  conversationId: string;
  message: string;
  response: string;
  timestamp: string;
  status: "success" | "error";
}

export interface GetConversationsResponse {
  conversations: Array<{
    id: string;
    title: string;
    lastMessage: string;
    timestamp: string;
    unread: number;
  }>;
}

/**
 * Send a message to the chatbot
 */
export async function sendChatbotMessage(
  request: SendMessageRequest,
  token: string,
): Promise<SendMessageResponse> {
  const response = await fetch(`${API_BASE_URL}/chatbot/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all conversations for the current user
 */
export async function getChatbotConversations(
  token: string,
): Promise<GetConversationsResponse> {
  const response = await fetch(`${API_BASE_URL}/chatbot/conversations`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch conversations: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get conversation history
 */
export async function getChatbotConversationHistory(
  conversationId: string,
  token: string,
): Promise<{
  messages: Array<{
    id: string;
    content: string;
    type: "user" | "bot";
    timestamp: string;
  }>;
}> {
  const response = await fetch(
    `${API_BASE_URL}/chatbot/conversations/${conversationId}/messages`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch message history: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new conversation
 */
export async function createChatbotConversation(
  title: string,
  token: string,
): Promise<{ id: string; title: string }> {
  const response = await fetch(`${API_BASE_URL}/chatbot/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a conversation
 */
export async function deleteChatbotConversation(
  conversationId: string,
  token: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/chatbot/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete conversation: ${response.statusText}`);
  }
}

/**
 * Get chatbot analytics or FAQ suggestions
 */
export async function getChatbotFAQ(token: string): Promise<{
  faqs: Array<{
    id: string;
    question: string;
    answer: string;
    category: string;
  }>;
}> {
  const response = await fetch(`${API_BASE_URL}/chatbot/faq`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch FAQ: ${response.statusText}`);
  }

  return response.json();
}
