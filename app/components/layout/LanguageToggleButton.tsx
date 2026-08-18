'use client';

import { useSyncExternalStore } from 'react';
import { Globe2 } from 'lucide-react';

const GOOGTRANS_COOKIE = 'googtrans';
const ENGLISH_VALUE = '/es/en';

// El widget de Google Translate lee esta cookie al cargar la página para decidir si
// traduce o no — no hay una API en JS para "activar" la traducción sin recargar de
// forma confiable entre navegadores, así que el patrón estándar es: setear/borrar la
// cookie y recargar. Se escribe en dos variantes (sin domain y con ".dominio") porque
// según cómo haya quedado seteada una vez, a veces solo una de las dos variantes pisa
// la anterior — con las dos cubiertas, borrar siempre funciona.
function setGoogTransCookie(value: string | null) {
  const host = window.location.hostname;
  if (value === null) {
    document.cookie = `${GOOGTRANS_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `${GOOGTRANS_COOKIE}=; path=/; domain=.${host}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    return;
  }
  document.cookie = `${GOOGTRANS_COOKIE}=${value}; path=/`;
  document.cookie = `${GOOGTRANS_COOKIE}=${value}; path=/; domain=.${host}`;
}

function subscribe() {
  // La cookie solo cambia desde este mismo botón, y toggleLanguage() recarga la
  // página después de escribirla — no hace falta reaccionar a cambios externos acá.
  return () => {};
}

function getSnapshot(): boolean {
  return document.cookie.includes(`${GOOGTRANS_COOKIE}=${ENGLISH_VALUE}`);
}

// El servidor no tiene document.cookie: arranca siempre en "sin traducir" (false) y
// useSyncExternalStore reconcilia con el valor real de la cookie apenas hidrata en el
// cliente, sin el warning de mismatch que tendría leer la cookie directo en el cuerpo
// del componente (mismo patrón que CookieConsentBanner.tsx).
function getServerSnapshot(): boolean {
  return false;
}

export function LanguageToggleButton() {
  const isEnglish = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggleLanguage() {
    setGoogTransCookie(isEnglish ? null : ENGLISH_VALUE);
    // Recarga completa: es lo que hace que Google Translate vuelva a inicializar el
    // widget leyendo la cookie recién seteada y traduzca (o restaure) la página.
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={isEnglish ? 'Volver al español' : 'Translate to English'}
      title={isEnglish ? 'Volver al español' : 'Translate to English'}
      className="flex h-8 items-center gap-1 rounded-full border border-[#232D38] px-2.5
                 text-[11px] font-bold text-[#8792A0] transition hover:border-[#3A4C63]
                 hover:text-[#F4F6F8]"
    >
      <Globe2 className="h-3.5 w-3.5" />
      {isEnglish ? 'ES' : 'EN'}
    </button>
  );
}
