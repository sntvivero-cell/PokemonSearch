import Link from 'next/link';

export function Footer() {
  return (
    <footer className="shrink-0 border-t border-[#232D38] bg-[#0B0F14] px-4 py-6">
      <nav className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[#8792A0]">
        <Link href="/legal/privacidad" className="transition hover:text-[#F4F6F8]">
          Política de Privacidad
        </Link>
        <Link href="/legal/terminos" className="transition hover:text-[#F4F6F8]">
          Términos de Uso
        </Link>
        <Link href="/contacto" className="transition hover:text-[#F4F6F8]">
          Contacto
        </Link>
        <Link href="/status" className="transition hover:text-[#F4F6F8]">
          Estado del sitio
        </Link>
      </nav>
      <p className="mx-auto max-w-2xl text-center text-[10px] leading-relaxed text-[#5C6773]">
        GoTraderz no está afiliado, respaldado ni asociado con Niantic, Inc., The Pokémon Company, Nintendo o Game
        Freak. Pokémon y Pokémon GO son marcas registradas de sus respectivos dueños. Este es un proyecto
        independiente de fans, no oficial.
      </p>
    </footer>
  );
}
