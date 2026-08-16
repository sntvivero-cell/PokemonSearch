'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';

type ConsentValue = 'accepted' | 'rejected';

const STORAGE_KEY = 'cookie_consent';

function subscribe() {
  // No hace falta reaccionar a cambios externos de localStorage acá (no hay otra
  // pestaña escribiendo esta clave en la práctica) — solo se usa
  // useSyncExternalStore para leer localStorage sin desincronizar el render de
  // servidor y el primer render de cliente (ver getServerSnapshot).
  return () => {};
}

function getSnapshot(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== 'accepted' && stored !== 'rejected';
}

// En el servidor no existe localStorage, así que no podemos saber si ya eligió
// antes — arrancamos siempre en "sin elección" oculto por defecto (false) y dejamos
// que useSyncExternalStore reconcilie con el valor real de localStorage apenas
// hidrata en el cliente, sin el warning de mismatch que tendría leer localStorage
// directo en el cuerpo del componente o en un useState perezoso.
function getServerSnapshot(): boolean {
  return false;
}

export function CookieConsentBanner() {
  const hasPendingChoice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);
  const isVisible = hasPendingChoice && !dismissed;

  function handleChoice(value: ConsentValue) {
    localStorage.setItem(STORAGE_KEY, value);
    setDismissed(true);

    // TODO: si en el futuro se agrega Google Analytics, ads, o cualquier cookie no
    // esencial, ese código debe quedar condicionado a
    // localStorage.getItem('cookie_consent') === 'accepted' antes de cargarse o
    // ejecutarse — nunca antes de que el usuario elija explícitamente. Hoy no hace
    // falta ningún bloqueo funcional acá porque solo usamos cookies técnicas
    // esenciales (sesión de Supabase Auth), que no requieren consentimiento previo
    // bajo RGPD/ePrivacy.
  }

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#232D38] bg-[#131A22] px-4 py-4
                 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-[#8792A0]">
          Usamos únicamente cookies técnicas esenciales para mantener tu sesión iniciada (autenticación vía
          Supabase). No usamos cookies de analítica ni de publicidad. Más info en nuestra{' '}
          <Link href="/legal/privacidad" className="font-semibold text-[#2E9BF5] hover:underline">
            Política de Privacidad
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => handleChoice('rejected')}
            className="flex-1 rounded-full border border-[#232D38] px-4 py-2 text-xs font-semibold
                       text-[#F4F6F8] transition hover:border-[#3A4C63] sm:flex-none"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => handleChoice('accepted')}
            className="flex-1 rounded-full bg-[#2E9BF5] px-4 py-2 text-xs font-semibold text-white
                       transition hover:bg-[#2589db] sm:flex-none"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
