import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/app/lib/supabaseClient';

// Borrado físico de cuentas que nunca confirmaron el email, pasadas las 24hs de
// creadas. Mismo motivo de fondo que /api/cleanup: handle_new_user() (trigger en
// auth.users) crea la fila en `profiles` INMEDIATAMENTE al signUp(), sin esperar
// confirmación — así que una cuenta que nunca confirma deja su username (unique
// constraint) y su email reservados para siempre, sin que nadie pueda volver a
// registrarse con ninguno de los dos. Esta ruta libera ambos automáticamente.
//
// Mismo patrón que /api/cleanup: pensada para un cron EXTERNO (no hay pg_cron en el
// plan de Supabase, y un cron interno de Next.js no sobrevive en serverless), mismo
// header Authorization: Bearer CRON_SECRET, misma respuesta JSON de resumen.
export const dynamic = 'force-dynamic';

const STALE_AFTER_HOURS = 24;
// listUsers() no permite filtrar por email_confirmed_at desde el SDK — hay que traer
// páginas enteras y filtrar acá. 200 es el máximo cómodo por request de la Admin API;
// para la escala actual del proyecto esto recorre pocas páginas.
const PAGE_SIZE = 200;

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

  // service_role: necesario para la Admin API de Auth (listUsers/deleteUser opera
  // sobre auth.users, fuera del alcance de RLS/PostgREST normal) y para borrar
  // `profiles` de cualquier usuario, no solo el propio.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000);
  const deletedUserIds: string[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      return NextResponse.json(
        { error: error.message, deletedCount: deletedUserIds.length, partial: true },
        { status: 500 }
      );
    }

    const staleUnconfirmed = data.users.filter(
      (u) => u.email_confirmed_at == null && new Date(u.created_at) < cutoff
    );

    for (const user of staleUnconfirmed) {
      // Se borra `profiles` explícitamente ANTES de deleteUser(): el schema de esta
      // tabla se creó a mano en el dashboard de Supabase antes de que existiera esta
      // carpeta de migraciones, así que no está confirmado en código si
      // profiles.user_id -> auth.users(id) tiene ON DELETE CASCADE. Borrando acá
      // primero, el borrado de auth.users no depende de esa cascada para liberar el
      // username — si la cascada sí existe, este delete simplemente no afecta filas.
      await supabaseAdmin.from('profiles').delete().eq('user_id', user.id);

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (!deleteError) {
        deletedUserIds.push(user.id);
      }
    }

    if (data.users.length < PAGE_SIZE) break;
    page++;
  }

  return NextResponse.json({
    ok: true,
    deletedCount: deletedUserIds.length,
    cutoff: cutoff.toISOString(),
    ranAt: new Date().toISOString(),
  });
}
