'use client';

import { use, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, User } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import { fetchUsernames } from '@/app/lib/profiles';
import type { ChatMessage } from '@/app/types/messages';

interface ChatPageProps {
  params: Promise<{ conversationId: string }>;
}

const MAX_MESSAGE_LENGTH = 1000;

export default function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = use(params);
  const { user, isLoading: isUserLoading } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherUsername, setOtherUsername] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isUserLoading) return;

    let cancelled = false;

    async function load() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('id, user_a, user_b')
        .eq('id', conversationId)
        .maybeSingle();

      if (cancelled) return;

      if (convError) {
        setLoadError(convError.message);
        setIsLoading(false);
        return;
      }
      if (!conversation) {
        setLoadError('No se encontró esta conversación.');
        setIsLoading(false);
        return;
      }
      if (conversation.user_a !== user!.id && conversation.user_b !== user!.id) {
        setForbidden(true);
        setIsLoading(false);
        return;
      }

      const other = conversation.user_a === user!.id ? (conversation.user_b as string) : (conversation.user_a as string);
      setOtherUserId(other);

      const [usernames, { data: messageRows, error: messagesError }] = await Promise.all([
        fetchUsernames([other]),
        supabase
          .from('messages')
          .select('id, conversation_id, sender_id, content, created_at, read')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
      ]);

      if (cancelled) return;

      setOtherUsername(usernames.get(other) ?? null);

      if (messagesError) {
        setLoadError(messagesError.message);
        setIsLoading(false);
        return;
      }

      setMessages((messageRows as ChatMessage[]) ?? []);
      setIsLoading(false);

      // Marca como leídos los mensajes del otro que todavía no lo estaban, al abrir
      // la conversación. La policy de UPDATE solo deja tocar la columna `read` de
      // mensajes ajenos dentro de conversaciones propias.
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user!.id)
        .eq('read', false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user, isUserLoading, conversationId]);

  // Los mensajes nuevos llegan solo por acá, tanto para quien envía como para quien
  // recibe — no hay append local optimista al enviar, así se evita duplicar el
  // mensaje propio (uno del insert local + otro del evento de Realtime).
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSendError(null);

    const trimmed = draft.trim();
    if (!trimmed || !user) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setSendError(`El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.`);
      return;
    }

    setIsSending(true);
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: trimmed,
    });
    setIsSending(false);

    if (error) {
      setSendError(`No se pudo enviar: ${error.message}`);
      return;
    }

    setDraft('');
  }

  if (isUserLoading || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-[#F4F6F8]">
        <p className="text-xs text-[#5C6773]">Cargando conversación…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0F14] px-4 text-center text-[#F4F6F8]">
        <p className="text-sm font-semibold">Necesitás iniciar sesión para ver esta conversación.</p>
        <Link href="/login" className="mt-2 text-xs font-semibold text-[#2E9BF5] hover:underline">
          Iniciar sesión
        </Link>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0F14] px-4 text-center text-[#F4F6F8]">
        <p className="text-sm font-semibold">No tenés acceso a esta conversación.</p>
        <Link href="/mensajes" className="mt-2 text-xs font-semibold text-[#2E9BF5] hover:underline">
          Volver a mensajes
        </Link>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0F14] px-4 text-center text-[#F4F6F8]">
        <p className="text-sm font-semibold text-[#FF3D3D]">{loadError}</p>
        <Link href="/mensajes" className="mt-2 text-xs font-semibold text-[#2E9BF5] hover:underline">
          Volver a mensajes
        </Link>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col bg-[#0B0F14] text-[#F4F6F8]">
      <header className="shrink-0 border-b border-[#232D38] bg-[#0B0F14]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Link
            href="/mensajes"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#232D38]
                       text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {otherUserId && (
            <Link href={`/usuario/${otherUserId}`} className="flex items-center gap-2 transition hover:opacity-80">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2E9BF5]/10">
                <User className="h-4 w-4 text-[#2E9BF5]" />
              </div>
              <h1 className="text-sm font-extrabold tracking-tight">{otherUsername ?? 'Entrenador'}</h1>
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-xs text-[#5C6773]">Todavía no hay mensajes. Escribí el primero.</p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    isMine ? 'bg-[#2E9BF5] text-white' : 'border border-[#232D38] bg-[#131A22] text-[#F4F6F8]'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`mt-1 text-right text-[9px] ${isMine ? 'text-white/70' : 'text-[#5C6773]'}`}>
                    {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 z-10 shrink-0 border-t border-[#232D38] bg-[#0B0F14] px-4 py-3
                   [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Escribí un mensaje…"
            style={{ fontSize: '16px' }}
            className="flex-1 rounded-full border border-[#232D38] bg-[#131A22] px-4 py-2.5
                       text-[#F4F6F8] placeholder:text-[#5C6773] outline-none transition focus:border-[#2E9BF5]"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2E9BF5] text-white
                       transition hover:bg-[#2589db] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {sendError && (
          <p className="mx-auto mt-2 max-w-2xl text-[10px] font-semibold text-[#FF3D3D]">{sendError}</p>
        )}
      </form>
    </main>
  );
}
