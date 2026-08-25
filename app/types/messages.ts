export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  // Puede ser null si el mensaje es solo imagen (ver `image_url`).
  content: string | null;
  // Path dentro del bucket privado "chat-images" (ej. "{conversation_id}/{id}.jpg"),
  // NO una URL utilizable directo — el bucket es privado, hace falta resolver una
  // signed URL (ver app/lib/chatImages.ts) antes de poder mostrarla.
  image_url: string | null;
  created_at: string;
  read: boolean;
}

export interface ConversationSummary {
  id: string;
  otherUserId: string;
  otherUsername: string | null;
  lastMessage: { content: string | null; image_url: string | null; created_at: string; sender_id: string } | null;
  hasUnread: boolean;
}
