import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

export const metadata = {
  title: 'Contacto — GoTraderz',
};

const CONTACT_EMAIL = 'contact@gotraderz.com';

export default function ContactPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 text-[#F4F6F8]">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-[#8792A0] transition hover:text-[#F4F6F8]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al feed
        </Link>

        <div className="rounded-2xl border border-[#232D38] bg-[#131A22] p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#2E9BF5]/10">
            <Mail className="h-5 w-5 text-[#2E9BF5]" />
          </div>
          <h1 className="mt-3 text-base font-extrabold tracking-tight">Contacto</h1>
          <p className="mt-1 text-xs text-[#5C6773]">
            ¿Dudas, problemas con tu cuenta o querés reportar algo? Escribinos.
          </p>

          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#2E9BF5]
                       px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#2589db]"
          >
            <Mail className="h-3.5 w-3.5" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </main>
  );
}
