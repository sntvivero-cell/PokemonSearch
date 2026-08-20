import { supabase } from '@/app/lib/supabaseClient';
import { fetchUsernames } from '@/app/lib/profiles';
import type { ConversationSummary } from '@/app/types/messages';

// Dado el usuario logueado y otro user_id, ordena el par (conversations.ordered_pair
// exige user_a < user_b) y busca o crea la conversación. Usa upsert con
// ignoreDuplicates en vez de un insert directo para manejar el caso de carrera: si
// dos personas abren el chat entre sí al mismo tiempo, el segundo insert no falla
// (tampoco intenta un UPDATE, que no tiene policy) — simplemente no inserta nada
// porque ya existe, y volvemos a leer la fila que ganó la carrera.
export async function getOrCreateConversation(currentUserId: string, otherUserId: string): Promise<string> {
  if (currentUserId === otherUserId) {
    throw new Error('You can\'t start a conversation with yourself.');
  }

  const [userA, userB] = [currentUserId, otherUserId].sort();

  const { data: existing, error: selectError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  if (existing) return existing.id as string;

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .upsert({ user_a: userA, user_b: userB }, { onConflict: 'user_a,user_b', ignoreDuplicates: true })
    .select('id');

  if (insertError) throw new Error(insertError.message);
  if (created && created.length > 0) return created[0].id as string;

  const { data: afterRace, error: afterRaceError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .single();

  if (afterRaceError || !afterRace) {
    throw new Error(afterRaceError?.message ?? 'Could not create or find the conversation.');
  }

  return afterRace.id as string;
}

async function fetchUnreadConversationIds(userId: string, conversationIds: string[]): Promise<Set<string>> {
  if (conversationIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id')
    .eq('read', false)
    .neq('sender_id', userId)
    .in('conversation_id', conversationIds);

  if (error) {
    console.error('Error fetching unread messages:', error.message);
    return new Set();
  }

  return new Set((data ?? []).map((m) => m.conversation_id as string));
}

// Cantidad de conversaciones con al menos un mensaje sin leer (no la cantidad total
// de mensajes sin leer) — es lo que se muestra en el badge del header global.
export async function fetchUnreadConversationCount(userId: string): Promise<number> {
  const { data: convRows, error } = await supabase
    .from('conversations')
    .select('id')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  if (error || !convRows || convRows.length === 0) return 0;

  const unread = await fetchUnreadConversationIds(
    userId,
    convRows.map((c) => c.id as string)
  );
  return unread.size;
}

// Lista de conversaciones del usuario con el username del otro participante y el
// último mensaje de cada una. El último mensaje se trae con una query por
// conversación (limit 1, ordenado desc) en vez de una sola consulta con "top 1 por
// grupo" — Postgres no lo resuelve simple sin una función/RPC aparte, y la cantidad
// de conversaciones de un DM 1 a 1 es chica, así que no vale la pena esa complejidad
// ahora. Si la lista crece mucho, se puede optimizar con una vista o RPC después.
export async function fetchConversationSummaries(userId: string): Promise<ConversationSummary[]> {
  const { data: convRows, error: convError } = await supabase
    .from('conversations')
    .select('id, user_a, user_b')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  if (convError) {
    console.error('Error fetching conversations:', convError.message);
    return [];
  }
  if (!convRows || convRows.length === 0) return [];

  const conversationIds = convRows.map((c) => c.id as string);
  const otherUserIds = convRows.map((c) => (c.user_a === userId ? (c.user_b as string) : (c.user_a as string)));

  const [usernames, lastMessages, unreadConversationIds] = await Promise.all([
    fetchUsernames(otherUserIds),
    Promise.all(
      conversationIds.map(async (id) => {
        const { data } = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('conversation_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { conversationId: id, message: data };
      })
    ),
    fetchUnreadConversationIds(userId, conversationIds),
  ]);

  const lastMessageByConversation = new Map(lastMessages.map((m) => [m.conversationId, m.message]));

  const summaries: ConversationSummary[] = convRows.map((c) => {
    const otherUserId = c.user_a === userId ? (c.user_b as string) : (c.user_a as string);
    return {
      id: c.id as string,
      otherUserId,
      otherUsername: usernames.get(otherUserId) ?? null,
      lastMessage: lastMessageByConversation.get(c.id as string) ?? null,
      hasUnread: unreadConversationIds.has(c.id as string),
    };
  });

  summaries.sort((a, b) => {
    const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
    const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
    return bTime - aTime;
  });

  return summaries;
}
