import Link from 'next/link';

// lucide-react no trae el logo de TikTok (no es un ícono "genérico" tipo flecha/lupa,
// es una marca registrada) y el proyecto no tiene react-icons instalado (confirmado:
// no está en package.json ni en node_modules) — path del glyph de Simple Icons
// (CC0, monocromo por diseño), con currentColor para heredar el mismo gris/hover que
// el resto de los links del footer en vez del logo a color oficial de TikTok, que
// desentonaría con la paleta oscura.
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="shrink-0 border-t border-[#232D38] bg-[#0B0F14] px-4 py-6">
      <nav className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[#8792A0]">
        <Link href="/legal/privacidad" className="transition hover:text-[#F4F6F8]">
          Privacy Policy
        </Link>
        <Link href="/legal/terminos" className="transition hover:text-[#F4F6F8]">
          Terms of Use
        </Link>
        <Link href="/contacto" className="transition hover:text-[#F4F6F8]">
          Contact
        </Link>
        <Link href="/status" className="transition hover:text-[#F4F6F8]">
          Site Status
        </Link>
        <Link href="/guide" className="transition hover:text-[#F4F6F8]">
          Trading Guide
        </Link>
        <a
          href="https://www.tiktok.com/@gotraderz.oficial"
          target="_blank"
          rel="noopener noreferrer"
          title="Follow us on TikTok"
          className="flex items-center gap-1.5 transition hover:text-[#F4F6F8]"
        >
          <TikTokIcon className="h-3.5 w-3.5" />
          Follow us on TikTok
        </a>
      </nav>
      <p className="mx-auto max-w-2xl text-center text-[10px] leading-relaxed text-[#5C6773]">
        GoTraderz is not affiliated with, endorsed by, or associated with Niantic, Inc., The Pokémon Company,
        Nintendo, or Game Freak. Pokémon and Pokémon GO are registered trademarks of their respective owners. This
        is an independent, unofficial fan project.
      </p>
    </footer>
  );
}
