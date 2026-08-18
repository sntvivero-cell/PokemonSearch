'use client';

import { useEffect } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate: {
        TranslateElement: new (
          options: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean },
          elementId: string
        ) => unknown;
      };
    };
  }
}

// Google Translate reescribe directamente los nodos de texto del DOM (los envuelve en
// <font>), por fuera de React. Cuando React después intenta desmontar/reconciliar esos
// mismos nodos (una card que desaparece al filtrar, un toast que se auto-oculta, un
// mensaje nuevo en el chat) puede tirar "Failed to execute 'removeChild'/'insertBefore'
// on 'Node'" porque el nodo que React cree que es hijo directo ya no lo es. Este parche
// (workaround estándar y ampliamente documentado para esta combinación específica,
// ver facebook/react#11538) hace que esas llamadas fallidas no rompan la app: si el
// nodo a remover/insertar ya no es hijo real, no hace nada en vez de lanzar. Se aplica
// una sola vez y ANTES de montar el script de Google (ver GoogleTranslate() abajo).
function patchDomForGoogleTranslate() {
  if (typeof window === 'undefined' || (window as { __gtPatched?: boolean }).__gtPatched) return;
  (window as { __gtPatched?: boolean }).__gtPatched = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      console.warn('[GoogleTranslate] removeChild bloqueado: el nodo ya no es hijo de este padre.', child);
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn('[GoogleTranslate] insertBefore bloqueado: la referencia ya no es hijo de este padre.', referenceNode);
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

// Monta el widget oficial de Google Translate Website Translator, oculto (ver CSS
// en globals.css que esconde la barra/iframe que agrega por defecto). El botón
// visible que el usuario realmente usa es LanguageToggleButton.tsx, que maneja este
// mismo widget por afuera vía la cookie googtrans.
export function GoogleTranslate() {
  useEffect(() => {
    patchDomForGoogleTranslate();
  }, []);

  return (
    <>
      <div id="google_translate_element" className="hidden" />
      <Script
        id="google-translate-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            function googleTranslateElementInit() {
              new google.translate.TranslateElement(
                { pageLanguage: 'es', includedLanguages: 'en', autoDisplay: false },
                'google_translate_element'
              );
            }
          `,
        }}
      />
      <Script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" strategy="afterInteractive" />
    </>
  );
}
