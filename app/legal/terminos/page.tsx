import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Términos de Uso — GoTraders',
};

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-[#F4F6F8]">
      <header className="border-b border-[#232D38] bg-[#0B0F14]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#232D38]
                       text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-base font-extrabold tracking-tight">Términos de Uso</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-[#8792A0]">
        <p className="mb-6 text-xs text-[#5C6773]">Última actualización: agosto de 2026.</p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">1. Qué es GoTraders</h2>
        <p className="mb-4">
          GoTraders es una herramienta hecha por fans para que jugadores de Pokémon GO puedan publicar qué Pokémon
          ofrecen y qué buscan a cambio, y coordinar intercambios entre ellos por chat. Es un proyecto independiente,
          no está afiliado con Niantic, Inc., The Pokémon Company, Nintendo ni Game Freak.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">2. Sin garantía de que los intercambios se concreten</h2>
        <p className="mb-4">
          GoTraders es solo un tablón de anuncios y un canal de contacto entre usuarios. No garantizamos que un
          intercambio publicado vaya a concretarse, ni verificamos la identidad, ubicación real o buena fe de otros
          usuarios. Coordinar y realizar el intercambio dentro de Pokémon GO es responsabilidad exclusiva de las
          personas involucradas.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">3. Responsabilidad sobre el contenido publicado</h2>
        <p className="mb-4">
          Cada usuario es el único responsable del contenido que publica: sus publicaciones de intercambio, notas,
          nombre de usuario, código de amigo (si lo carga) y mensajes de chat. GoTraders no revisa previamente ese
          contenido antes de que se publique.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">4. Qué no está permitido</h2>
        <p className="mb-2">No está permitido usar GoTraders para publicar o enviar:</p>
        <ul className="mb-4 ml-4 list-disc space-y-1">
          <li>Contenido ofensivo, discriminatorio, de acoso o amenazante.</li>
          <li>Spam, publicidad no relacionada, o publicaciones repetidas de forma abusiva.</li>
          <li>Contenido ilegal, o que promueva actividades ilegales (por ejemplo, suplantación de ubicación con fines de estafa).</li>
          <li>Intentos de estafa a otros usuarios, o suplantación de identidad.</li>
        </ul>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">5. Moderación</h2>
        <p className="mb-4">
          Podemos eliminar publicaciones, mensajes o cuentas que violen estas reglas, sin previo aviso y a nuestro
          criterio, para mantener la comunidad utilizable para todos.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">6. El servicio se ofrece &ldquo;tal cual&rdquo;</h2>
        <p className="mb-4">
          GoTraders se ofrece &ldquo;tal cual&rdquo; (&ldquo;as is&rdquo;) y &ldquo;según disponibilidad&rdquo;, sin garantías de ningún tipo, ni
          explícitas ni implícitas, incluyendo (pero sin limitarse a) garantías de disponibilidad ininterrumpida,
          ausencia de errores, o idoneidad para un propósito particular. Usás el servicio bajo tu propio riesgo.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">7. Cambios a estos términos</h2>
        <p className="mb-4">
          Podemos actualizar estos términos ocasionalmente. Si hacemos cambios importantes, lo indicaremos
          actualizando la fecha al inicio de esta página.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">8. Contacto</h2>
        <p className="mb-4">
          Para consultas sobre estos términos, escribinos a{' '}
          <a href="mailto:contacto@tudominio.com" className="text-[#2E9BF5] hover:underline">
            contacto@tudominio.com
          </a>{' '}
          [COMPLETAR: reemplazar por tu email de contacto real].
        </p>
      </div>
    </main>
  );
}
