'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, User } from 'lucide-react';
import { useUser } from '@/app/hooks/useUser';
import { fetchConversationSummaries } from '@/app/lib/conversations';
import { timeAgo } from '@/app/lib/timeAgo';
import type { ConversationSummary } from '@/app/types/messages';

export default function MessagesListPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading) return;

    async function load() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setConversations(await fetchConversationSummaries(user.id));
      setIsLoading(false);
    }

    load();
  }, [user, isUserLoading]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-[#F4F6F8]">
      <header className="sticky top-0 z-10 border-b border-[#232D38] bg-[#0B0F14]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#232D38]
                       text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-extrabold tracking-tight">Messages</h1>
            <p className="text-xs text-[#5C6773]">Your conversations</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {isUserLoading || isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl border border-[#232D38] bg-[#131A22]" />
            ))}
          </div>
        ) : !user ? (
          <p className="rounded-xl border border-[#232D38] bg-[#131A22] px-3 py-2.5 text-xs text-[#8792A0]">
            You need to sign in to see your messages.{' '}
            <Link href="/login" className="font-semibold text-[#2E9BF5] hover:underline">
              Sign in
            </Link>
          </p>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#232D38] py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2E9BF5]/10">
              <MessageCircle className="h-5 w-5 text-[#2E9BF5]" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#F4F6F8]">You don&apos;t have any conversations yet</p>
            <p className="mt-1 max-w-xs text-xs text-[#5C6773]">
              Message a trainer from their profile to start chatting.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/mensajes/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-[#232D38] bg-[#131A22] p-3
                           transition hover:border-[#3A4C63]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2E9BF5]/10">
                  <User className="h-4 w-4 text-[#2E9BF5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[#F4F6F8]">
                      {c.otherUsername ?? 'Trainer'}
                    </p>
                    {c.lastMessage && (
                      <span className="shrink-0 text-[10px] text-[#5C6773]">
                        {timeAgo(c.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  <p
                    className={`truncate text-xs ${
                      c.hasUnread ? 'font-semibold text-[#8792A0]' : 'text-[#5C6773]'
                    }`}
                  >
                    {c.lastMessage ? c.lastMessage.content : 'No messages yet'}
                  </p>
                </div>
                {c.hasUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#2E9BF5]" />}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
