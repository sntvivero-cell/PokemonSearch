import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertTriangle, Wrench, XCircle, HelpCircle } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { timeAgo } from '@/app/lib/timeAgo';

// Server component, sin 'use client': se refresca en cada carga (dynamic='force-dynamic'
// evita que Next.js cachee el fetch) — el dato es chico y se actualiza a mano desde el
// SQL Editor de Supabase (ver migración 0009_site_status.sql), no hace falta revalidación
// más fina que esa.
export const dynamic = 'force-dynamic';

type SiteStatusValue = 'operational' | 'degraded' | 'maintenance' | 'down';

interface SiteStatusRow {
  status: SiteStatusValue;
  message: string | null;
  updated_at: string;
}

const STATUS_CONFIG: Record<
  SiteStatusValue,
  { label: string; color: string; Icon: typeof CheckCircle2 }
> = {
  operational: { label: 'Todo funciona con normalidad', color: '#22C55E', Icon: CheckCircle2 },
  degraded: { label: 'Estamos experimentando algunos problemas', color: '#FFCB05', Icon: AlertTriangle },
  maintenance: { label: 'En mantenimiento programado', color: '#2E9BF5', Icon: Wrench },
  down: { label: 'El servicio no está disponible temporalmente', color: '#FF3D3D', Icon: XCircle },
};

async function getSiteStatus(): Promise<SiteStatusRow | null> {
  // Debería haber una sola fila (se actualiza in place, no se inserta una nueva por
  // cambio de estado), pero se ordena por updated_at igual por robustez ante ese caso.
  const { data, error } = await supabase
    .from('site_status')
    .select('status, message, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching site_status:', error.message);
    return null;
  }

  return data as SiteStatusRow | null;
}

export default async function StatusPage() {
  const siteStatus = await getSiteStatus();
  const config = siteStatus ? STATUS_CONFIG[siteStatus.status] : null;
  const Icon = config?.Icon ?? HelpCircle;
  const color = config?.color ?? '#8792A0';

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

        <div className="rounded-2xl border border-[#232D38] bg-[#131A22] p-6">
          <h1 className="mb-5 text-center text-base font-extrabold tracking-tight">Estado del sitio</h1>

          <div className="flex flex-col items-center text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: `${color}1a` }}
            >
              <Icon className="h-7 w-7" style={{ color }} />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <p className="text-sm font-bold" style={{ color }}>
                {config?.label ?? 'Estado desconocido'}
              </p>
            </div>

            {siteStatus?.message && (
              <p className="mt-3 rounded-xl border border-[#232D38] bg-[#0B0F14] px-3 py-2.5 text-xs text-[#8792A0]">
                {siteStatus.message}
              </p>
            )}

            <p className="mt-4 text-[10px] text-[#5C6773]">
              {siteStatus ? `Última actualización: ${timeAgo(siteStatus.updated_at)}` : 'No se pudo cargar el estado.'}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
