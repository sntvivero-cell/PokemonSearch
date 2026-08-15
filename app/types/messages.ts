export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

export interface ConversationSummary {
  id: string;
  otherUserId: string;
  otherUsername: string | null;
  lastMessage: { content: string; created_at: string; sender_id: string } | null;
  hasUnread: boolean;
}
