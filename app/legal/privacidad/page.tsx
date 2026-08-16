import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Política de Privacidad — GoTraders',
};

export default function PrivacyPolicyPage() {
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
          <h1 className="text-base font-extrabold tracking-tight">Política de Privacidad</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-[#8792A0]">
        <p className="mb-6 text-xs text-[#5C6773]">Última actualización: agosto de 2026.</p>

        <p className="mb-4">
          Esta política explica qué datos personales recoge <strong className="text-[#F4F6F8]">GoTraders</strong>{' '}
          (en adelante, &ldquo;la app&rdquo;, &ldquo;el sitio&rdquo; o &ldquo;nosotros&rdquo;), para qué los usa y qué derechos tenés sobre ellos bajo
          el Reglamento General de Protección de Datos (RGPD) de la Unión Europea, en caso de que residas en la UE,
          o bajo la normativa de protección de datos que corresponda a tu país.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">1. Responsable del tratamiento</h2>
        <p className="mb-4">
          GoTraders es un proyecto independiente de fans, gestionado por su propio equipo. Para cualquier
          consulta sobre esta política o tus datos personales, podés escribir a{' '}
          <a href="mailto:contacto@tudominio.com" className="text-[#2E9BF5] hover:underline">
            contacto@tudominio.com
          </a>{' '}
          [COMPLETAR: reemplazar por tu email de contacto real].
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">2. Qué datos recogemos</h2>
        <p className="mb-2">Para poder usar GoTraders recogemos:</p>
        <ul className="mb-4 ml-4 list-disc space-y-1">
          <li>Tu dirección de email, al crear una cuenta.</li>
          <li>El nombre de usuario que elegís al registrarte.</li>
          <li>Tu código de amigo de Pokémon GO, únicamente si decidís cargarlo (es un campo opcional).</li>
          <li>El contenido de las publicaciones de intercambio que creás (Pokémon ofrecidos/buscados, notas, etc.).</li>
          <li>El contenido de los mensajes que enviás por el chat interno a otros usuarios.</li>
        </ul>
        <p className="mb-4">
          No recogemos datos de pago (GoTraders no procesa pagos) ni datos de ubicación precisa más allá de lo que
          vos mismo escribas en tus publicaciones o mensajes.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">3. Dónde se almacenan los datos</h2>
        <p className="mb-4">
          Los datos se almacenan en la infraestructura de <strong className="text-[#F4F6F8]">Supabase</strong>,
          nuestro proveedor de base de datos y autenticación (Supabase, Inc.). Supabase corre sobre infraestructura
          de AWS y permite elegir, al crear un proyecto, la región de AWS donde se aloja: puede ser una región
          dentro de la Unión Europea (por ejemplo Frankfurt o Irlanda) o fuera de ella, según cómo se haya
          configurado este proyecto en particular.
        </p>
        <p className="mb-4 rounded-xl border border-[#2E9BF5]/40 bg-[#2E9BF5]/10 px-3 py-2.5 text-xs font-semibold text-[#2E9BF5]">
          [COMPLETAR]: confirmá la región exacta de este proyecto de Supabase en el dashboard (Project Settings →
          General → Region) y reemplazá este párrafo indicando la región específica. Si la región elegida está
          fuera de la Unión Europea, agregá una mención a las garantías que aplica Supabase para transferencias
          internacionales de datos (por ejemplo, Cláusulas Contractuales Tipo de la UE), según lo que indique la
          documentación de Supabase vigente al momento de publicar esta política.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">4. Cookies</h2>
        <p className="mb-4">
          Usamos únicamente cookies y almacenamiento local técnicos, estrictamente necesarios para el
          funcionamiento del sitio: mantener tu sesión iniciada a través de Supabase Auth, y recordar tu elección
          sobre el aviso de cookies. No usamos cookies de analítica, seguimiento ni publicidad. Si en el futuro
          incorporamos alguna, actualizaremos esta política y pediremos tu consentimiento explícito antes de
          activarlas.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">5. Para qué usamos tus datos</h2>
        <p className="mb-4">
          Usamos tus datos exclusivamente para operar el servicio: mostrar tus publicaciones y tu nombre de usuario
          a otros usuarios de la comunidad, permitir que te contacten por chat, y mantener tu sesión iniciada.{' '}
          <strong className="text-[#F4F6F8]">
            No vendemos ni compartimos tus datos con terceros, y no los usamos con fines publicitarios.
          </strong>
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">6. Tus derechos</h2>
        <p className="mb-2">Si tus datos están protegidos por el RGPD (u otra normativa equivalente), tenés derecho a:</p>
        <ul className="mb-4 ml-4 list-disc space-y-1">
          <li><strong className="text-[#F4F6F8]">Acceso</strong>: saber qué datos tuyos tenemos.</li>
          <li><strong className="text-[#F4F6F8]">Rectificación</strong>: corregir datos incorrectos (podés editar tu username y código de amigo vos mismo desde Configuración).</li>
          <li><strong className="text-[#F4F6F8]">Supresión</strong> (&ldquo;derecho al olvido&rdquo;): pedir que borremos tu cuenta y tus datos.</li>
          <li><strong className="text-[#F4F6F8]">Oposición y limitación</strong> del tratamiento de tus datos.</li>
          <li><strong className="text-[#F4F6F8]">Portabilidad</strong>: pedir una copia de tus datos en un formato reutilizable.</li>
        </ul>
        <p className="mb-4">
          Para ejercer cualquiera de estos derechos, incluyendo el borrado completo de tu cuenta, escribinos a{' '}
          <a href="mailto:contacto@tudominio.com" className="text-[#2E9BF5] hover:underline">
            contacto@tudominio.com
          </a>{' '}
          [COMPLETAR] indicando tu nombre de usuario o email registrado.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">7. Cuánto tiempo conservamos tus datos</h2>
        <p className="mb-4">
          Conservamos tus datos mientras tu cuenta esté activa. Si pedís la baja de tu cuenta, eliminamos tus datos
          personales y publicaciones asociadas, salvo que la ley nos obligue a conservar algún registro por más
          tiempo.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">8. Cambios a esta política</h2>
        <p className="mb-4">
          Podemos actualizar esta política ocasionalmente. Si hacemos cambios importantes, lo indicaremos
          actualizando la fecha al inicio de esta página.
        </p>
      </div>
    </main>
  );
}
