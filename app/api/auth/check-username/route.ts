import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/app/lib/supabaseClient';

// Le dice al formulario de signup (app/login/page.tsx) en qué estado exacto está un
// username antes de intentar crear la cuenta:
//   - 'available':   nadie lo tiene, se puede usar.
//   - 'taken':       lo tiene una cuenta YA CONFIRMADA (o hubo un error leyendo el
//                     estado real — se cae a este caso por seguridad, ver abajo).
//   - 'unconfirmed': lo tiene una cuenta que nunca confirmó el email. Antes esto
//                     mostraba el mismo "ya está en uso" que 'taken', dejando a esa
//                     persona sin poder reintentar ni saber por qué (bug reportado).
//
// email_confirmed_at vive en auth.users, no en `profiles` ni expuesto por PostgREST
// normal — por eso hace falta este route handler con service_role (Admin API de
// Auth) en vez de resolverlo con un SELECT directo desde el cliente.
//
// Nota de superficie de info: esta ruta expone si un username existe y si esa cuenta
// está confirmada. No es una regresión de seguridad nueva: `profiles.username` ya
// era públicamente legible antes de este cambio (policy "Anyone can view profiles"),
// así que "¿existe este username?" ya se podía consultar. Lo único que se agrega es
// el estado confirmado/no, que no identifica a la persona (no expone el email).
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';

  if (!username) {
    return NextResponse.json({ error: 'Missing username.' }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing SUPABASE_SERVICE_ROLE_KEY in server environment variables.' },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('user_id')
    .eq('username', username)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ status: 'available' });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);

  if (userError || !userData.user) {
    // Perfil sin auth.users detrás (ej. una carrera muy poco probable con el cron de
    // /api/cleanup-unconfirmed-accounts borrando justo en este momento). Se informa
    // 'taken' en vez de 'available': si igual quedó la fila en `profiles`, un signUp
    // ahora mismo chocaría contra la unique constraint de todos modos.
    return NextResponse.json({ status: 'taken' });
  }

  return NextResponse.json({ status: userData.user.email_confirmed_at ? 'taken' : 'unconfirmed' });
}
