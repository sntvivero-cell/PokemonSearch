'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';

// Misma clave que CookieConsentBanner.tsx — no se re-exporta desde ahí para no crear
// un acoplamiento entre los dos componentes, pero tiene que ser el mismo string.
const COOKIE_CONSENT_KEY = 'cookie_consent';

export function NotificationNoticeBanner() {
  const { user, isLoading: isUserLoading } = useUser();
  const [shouldShow, setShouldShow] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (isUserLoading || !user) {
      setShouldShow(false);
      return;
    }

    // Si el banner de cookies todavía no tiene una elección guardada, no mostramos
    // este también — los dos son `fixed bottom-0`, y superpuestos serían ilegibles.
    // En vez de coordinar estado entre componentes separados, simplemente esperamos:
    // este aviso aparece recién en la próxima carga de página después de que el
    // usuario resuelva el de cookies, lo cual sigue siendo "la primera vez que entra"
    // a efectos prácticos.
    const hasPendingCookieChoice = localStorage.getItem(COOKIE_CONSENT_KEY) == null;
    if (hasPendingCookieChoice) {
      setShouldShow(false);
      return;
    }

    let cancelled = false;

    async function checkNotice() {
      const { data, error } = await supabase
        .from('profiles')
        .select('has_seen_notification_notice')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Error checking notification notice:', error.message);
        return;
      }

      setShouldShow(data?.has_seen_notification_notice === false);
    }

    checkNotice();

    return () => {
      cancelled = true;
    };
  }, [user, isUserLoading]);

  async function handleDismiss() {
    if (!user) return;

    setIsDismissing(true);
    // Optimista: se oculta al toque, no hace falta esperar la respuesta del servidor
    // para algo puramente informativo que no se puede "deshacer".
    setShouldShow(false);

    const { error } = await supabase
      .from('profiles')
      .update({ has_seen_notification_notice: true })
      .eq('user_id', user.id);

    setIsDismissing(false);

    if (error) {
      console.error('Error dismissing notification notice:', error.message);
    }
  }

  if (!shouldShow) return null;

  return (
    <div
      role="dialog"
      aria-label="Email notifications notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#232D38] bg-[#131A22] px-4 py-4
                 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-[#8792A0]">
          We&apos;ll send you an email if someone messages you or posts a Pokémon you&apos;re watching. You can
          turn this off anytime in{' '}
          <Link href="/configuracion" className="font-semibold text-[#2E9BF5] hover:underline">
            Settings
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isDismissing}
          className="shrink-0 rounded-full bg-[#2E9BF5] px-4 py-2 text-xs font-semibold text-white
                     transition hover:bg-[#2589db] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
