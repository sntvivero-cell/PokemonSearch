'use client';

import { use, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, Paperclip, Send, User, X } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import { fetchUsernames } from '@/app/lib/profiles';
import { getChatImageSignedUrl, uploadChatImage, validateChatImageFile } from '@/app/lib/chatImages';
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // path (image_url) -> signed URL ya resuelta. El bucket es privado, así que hace
  // falta pedir una signed URL por imagen antes de poder mostrarla (ver
  // app/lib/chatImages.ts) — se resuelven a medida que llegan mensajes con imagen,
  // tanto del historial inicial como de Realtime.
  const [imageSignedUrls, setImageSignedUrls] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        setLoadError('This conversation was not found.');
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
          .select('id, conversation_id, sender_id, content, image_url, created_at, read')
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

  useEffect(() => {
    const pathsToResolve = messages
      .map((m) => m.image_url)
      .filter((path): path is string => path != null && !(path in imageSignedUrls));

    if (pathsToResolve.length === 0) return;

    let cancelled = false;

    async function resolveSignedUrls() {
      const entries = await Promise.all(
        pathsToResolve.map(async (path) => [path, await getChatImageSignedUrl(path)] as const)
      );
      if (cancelled) return;

      setImageSignedUrls((prev) => {
        const next = { ...prev };
        for (const [path, url] of entries) {
          if (url) next[path] = url;
        }
        return next;
      });
    }

    resolveSignedUrls();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Revoca el object URL del preview al desmontar o al reemplazarlo, para no filtrar
  // memoria (URL.createObjectURL mantiene el blob vivo hasta que se revoca a mano).
  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl);
    };
  }, [selectedImagePreviewUrl]);

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Se limpia el value del input siempre, así elegir el MISMO archivo dos veces
    // seguidas (ej. después de cancelar) dispara onChange de nuevo.
    e.target.value = '';
    if (!file) return;

    setSendError(null);
    const validationError = validateChatImageFile(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }

    setImageError(null);
    if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl);
    setSelectedImage(file);
    setSelectedImagePreviewUrl(URL.createObjectURL(file));
  }

  function handleCancelImage() {
    if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl);
    setSelectedImage(null);
    setSelectedImagePreviewUrl(null);
    setImageError(null);
  }

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSendError(null);

    const trimmed = draft.trim();
    if (!trimmed && !selectedImage) return;
    if (!user) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    setIsSending(true);

    let imagePath: string | null = null;
    // Generado ACÁ, no dejado al default de la tabla: la policy de Storage necesita
    // que el path suba usando el mismo id que va a tener la fila de `messages`, y esa
    // fila todavía no existe en este punto — se le pasa `id` explícito al insert de
    // abajo para que coincida.
    const messageId = selectedImage ? crypto.randomUUID() : null;

    if (selectedImage && messageId) {
      setIsUploadingImage(true);
      try {
        imagePath = await uploadChatImage(selectedImage, conversationId, messageId);
      } catch (err) {
        setIsUploadingImage(false);
        setIsSending(false);
        setSendError(err instanceof Error ? err.message : 'Could not upload the image.');
        return;
      }
      setIsUploadingImage(false);
    }

    const { error } = await supabase.from('messages').insert({
      ...(messageId ? { id: messageId } : {}),
      conversation_id: conversationId,
      sender_id: user.id,
      content: trimmed || null,
      image_url: imagePath,
    });

    setIsSending(false);

    if (error) {
      setSendError(`Could not send: ${error.message}`);
      return;
    }

    setDraft('');
    handleCancelImage();
  }

  if (isUserLoading || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-[#F4F6F8]">
        <p className="text-xs text-[#5C6773]">Loading conversation…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0F14] px-4 text-center text-[#F4F6F8]">
        <p className="text-sm font-semibold">You need to sign in to see this conversation.</p>
        <Link href="/login" className="mt-2 text-xs font-semibold text-[#2E9BF5] hover:underline">
          Sign in
        </Link>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0F14] px-4 text-center text-[#F4F6F8]">
        <p className="text-sm font-semibold">You don&apos;t have access to this conversation.</p>
        <Link href="/mensajes" className="mt-2 text-xs font-semibold text-[#2E9BF5] hover:underline">
          Back to messages
        </Link>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0F14] px-4 text-center text-[#F4F6F8]">
        <p className="text-sm font-semibold text-[#FF3D3D]">{loadError}</p>
        <Link href="/mensajes" className="mt-2 text-xs font-semibold text-[#2E9BF5] hover:underline">
          Back to messages
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
              <h1 className="text-sm font-extrabold tracking-tight">{otherUsername ?? 'Trainer'}</h1>
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-xs text-[#5C6773]">No messages yet. Write the first one.</p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === user.id;
            const imageSignedUrl = m.image_url ? imageSignedUrls[m.image_url] : null;
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    isMine ? 'bg-[#2E9BF5] text-white' : 'border border-[#232D38] bg-[#131A22] text-[#F4F6F8]'
                  }`}
                >
                  {m.image_url && (
                    <button
                      type="button"
                      onClick={() => imageSignedUrl && setLightboxUrl(imageSignedUrl)}
                      disabled={!imageSignedUrl}
                      className={`relative mb-1.5 block h-[220px] w-[220px] max-w-full overflow-hidden rounded-lg
                                  bg-black/20 ${imageSignedUrl ? 'cursor-zoom-in' : 'cursor-default'}`}
                    >
                      {imageSignedUrl ? (
                        <Image src={imageSignedUrl} alt="Sent image" fill sizes="220px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-[#5C6773]" />
                        </div>
                      )}
                    </button>
                  )}
                  {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                  <p className={`mt-1 text-right text-[9px] ${isMine ? 'text-white/70' : 'text-[#5C6773]'}`}>
                    {new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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
        {selectedImagePreviewUrl && (
          <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#232D38]">
              <Image src={selectedImagePreviewUrl} alt="" fill sizes="56px" className="object-cover" />
            </div>
            <span className="min-w-0 flex-1 truncate text-xs text-[#8792A0]">{selectedImage?.name}</span>
            <button
              type="button"
              onClick={handleCancelImage}
              disabled={isSending}
              title="Remove image"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#232D38]
                         text-[#8792A0] transition hover:border-[#FF3D3D] hover:text-[#FF3D3D]
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            title="Attach image"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#232D38]
                       text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]
                       disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Write a message…"
            style={{ fontSize: '16px' }}
            className="flex-1 rounded-full border border-[#232D38] bg-[#131A22] px-4 py-2.5
                       text-[#F4F6F8] placeholder:text-[#5C6773] outline-none transition focus:border-[#2E9BF5]"
          />
          <button
            type="submit"
            disabled={isSending || (!draft.trim() && !selectedImage)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2E9BF5] text-white
                       transition hover:bg-[#2589db] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {imageError && (
          <p className="mx-auto mt-2 max-w-2xl text-[10px] font-semibold text-[#FF3D3D]">{imageError}</p>
        )}
        {sendError && (
          <p className="mx-auto mt-2 max-w-2xl text-[10px] font-semibold text-[#FF3D3D]">{sendError}</p>
        )}
      </form>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border
                       border-[#232D38] bg-[#131A22] text-[#F4F6F8] transition hover:border-[#3A4C63]"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative h-[80vh] w-full max-w-2xl">
            <Image src={lightboxUrl} alt="Sent image" fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </main>
  );
}
