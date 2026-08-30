import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/app/lib/supabaseClient';

// Procesa notification_queue (sent_at is null) y manda el email vía la API HTTP de
// Resend directamente (fetch, sin el SDK `resend` — evita una dependencia nueva para
// un solo POST). Se llama de dos formas posibles:
//   1. Un Database Webhook de Supabase (INSERT en notification_queue) — dispara esto
//      casi al instante después de encolar, sin esperar ningún cron.
//   2. Manual/cron de respaldo, con el mismo POST y el mismo header.
// El body del webhook NO se lee: cada invocación vuelve a consultar TODAS las filas
// pendientes (sent_at is null), no solo la que disparó el webhook — así es idempotente
// ante reintentos o llamadas manuales, y no depende del formato exacto del payload
// que mande Supabase.
//
// No cachear nunca esta ruta: hace mutaciones (UPDATE sent_at) disparadas por POST.
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 50;
const SITE_URL = process.env.SITE_URL ?? 'https://gotraderz.com';
const FROM_ADDRESS = 'GoTraderz <notifications@gotraderz.com>';

interface NotificationRow {
  id: string;
  type: 'new_message' | 'watchlist_match';
  recipient_user_id: string;
  payload: Record<string, unknown>;
}

function buildEmail(row: NotificationRow): { subject: string; html: string } | null {
  if (row.type === 'new_message') {
    const senderUsername = typeof row.payload.senderUsername === 'string' ? row.payload.senderUsername : 'A trainer';
    const conversationId = row.payload.conversationId;
    if (typeof conversationId !== 'string') return null;

    return {
      subject: `${senderUsername} sent you a message on GoTraderz`,
      html: `
        <p><strong>${escapeHtml(senderUsername)}</strong> sent you a new message on GoTraderz.</p>
        <p><a href="${SITE_URL}/mensajes/${conversationId}">Open the conversation</a></p>
      `,
    };
  }

  if (row.type === 'watchlist_match') {
    const pokemonName = typeof row.payload.pokemonName === 'string' ? row.payload.pokemonName : 'A Pokémon';
    const publisherUserId = row.payload.publisherUserId;
    if (typeof publisherUserId !== 'string') return null;

    return {
      subject: `${pokemonName} you're watching just got posted`,
      html: `
        <p>Someone just posted a trade offering <strong>${escapeHtml(pokemonName)}</strong> — a Pokémon on your watchlist.</p>
        <p><a href="${SITE_URL}/usuario/${publisherUserId}">See their profile and posts</a></p>
      `,
    };
  }

  return null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Falta CRON_SECRET en las variables de entorno del servidor.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');

  // TEMPORAL — sacar apenas se resuelva el 401 en producción (ver conversación).
  // No loguea ningún valor secreto completo, solo longitudes/prefijo, para poder
  // distinguir en los logs de Vercel entre "llegó vacío", "llegó sin el prefijo
  // Bearer", o "llegó con el prefijo pero longitud distinta a la esperada" sin
  // exponer CRON_SECRET en texto plano.
  console.log('[send-notifications] auth debug', {
    headerPresent: authHeader != null,
    headerLength: authHeader?.length ?? 0,
    headerStartsWithBearer: authHeader?.startsWith('Bearer ') ?? false,
    envSecretLength: cronSecret.length,
    expectedHeaderLength: `Bearer ${cronSecret}`.length,
  });

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.' },
      { status: 500 }
    );
  }
  if (!resendApiKey) {
    return NextResponse.json({ error: 'Falta RESEND_API_KEY en las variables de entorno del servidor.' }, { status: 500 });
  }

  // service_role: necesario para leer/actualizar notification_queue (RLS sin
  // policies, solo accesible bypasseando RLS) y para resolver el email del
  // destinatario vía la Admin API (auth.users no se expone por PostgREST).
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error: fetchError } = await supabaseAdmin
    .from('notification_queue')
    .select('id, type, recipient_user_id, payload')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of (rows ?? []) as NotificationRow[]) {
    const email = buildEmail(row);
    if (!email) {
      // Payload inválido/inesperado: no reintentar en loop infinito — se descarta
      // marcándola como enviada igual, pero queda logueado para investigar.
      console.error(`notification ${row.id}: payload inválido para type '${row.type}'`, row.payload);
      await supabaseAdmin.from('notification_queue').update({ sent_at: new Date().toISOString() }).eq('id', row.id);
      skipped++;
      continue;
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(row.recipient_user_id);
    const recipientEmail = userData?.user?.email;

    if (userError || !recipientEmail) {
      console.error(`notification ${row.id}: no se pudo resolver el email del destinatario`, userError?.message);
      failed++;
      continue;
    }

    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: recipientEmail,
          subject: email.subject,
          html: email.html,
        }),
      });

      if (!resendResponse.ok) {
        const body = await resendResponse.text();
        console.error(`notification ${row.id}: Resend respondió ${resendResponse.status}`, body);
        failed++;
        continue;
      }

      await supabaseAdmin.from('notification_queue').update({ sent_at: new Date().toISOString() }).eq('id', row.id);
      sent++;
    } catch (err) {
      console.error(`notification ${row.id}: error de red mandando el email`, err);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: rows?.length ?? 0,
    sent,
    skipped,
    failed,
    ranAt: new Date().toISOString(),
  });
}
