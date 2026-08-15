import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/app/lib/supabaseClient';

// Borrado físico de posts inactivos hace más de 7 días. Pensado para ser disparado
// por un cron EXTERNO (cron-job.org, GitHub Actions schedule, etc.) una vez al día —
// no hay pg_cron disponible en el plan de Supabase, y un cron interno de Next.js
// (setInterval, node-cron) no es confiable en un entorno serverless como Vercel: el
// proceso no queda corriendo entre requests.
//
// No cachear nunca esta ruta: es una mutación (DELETE) disparada por GET.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Falta CRON_SECRET en las variables de entorno del servidor.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.' },
      { status: 500 }
    );
  }

  // service_role salta RLS a propósito: esta ruta corre en servidor sin sesión de
  // usuario (la dispara un cron externo), así que necesita borrar filas de
  // cualquier usuario, no solo las que auth.uid() permitiría.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('user_trades')
    .delete()
    .lt('updated_at', sevenDaysAgo)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deletedCount: data?.length ?? 0,
    cutoff: sevenDaysAgo,
    ranAt: new Date().toISOString(),
  });
}
