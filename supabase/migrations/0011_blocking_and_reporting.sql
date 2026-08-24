-- Bloqueo y reporte de usuarios. Dos tablas nuevas, independientes de todo lo demás:
-- no tocan user_trades, profiles (fuera de la columna nueva de abajo), ni el sistema
-- de rangos/cooldown existente.
--
-- La parte de "marcar trade como completado" (constraint de user_trades.status +
-- mark_trade_completed()) y el ajuste de la policy de INSERT en `messages` para
-- respetar el bloqueo van en una migración aparte (0012), porque dependen de
-- confirmar en vivo el constraint actual de status y la policy actual de messages
-- (ninguna de las dos tablas tiene su definición en este repo — se crearon a mano en
-- el SQL Editor de Supabase, así que no hay migración previa de la que partir).

-- 1. Columna nueva en profiles para el contador de trades completados. Acumulado,
-- igual criterio que total_trades_published (migración 0008): nunca decrece, ni
-- siquiera si el usuario borra el post después de completarlo.
alter table public.profiles add column total_trades_completed integer not null default 0;

-- 2. blocked_users: quién bloqueó a quién. Solo tus propias filas son visibles/
-- modificables (auth.uid() = user_id) — no hace falta que el bloqueado sepa quién lo
-- bloqueó, ni que nadie más pueda ver la lista de bloqueos de otra persona.
create table public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, blocked_user_id),
  check (user_id <> blocked_user_id)
);

alter table public.blocked_users enable row level security;

create policy "Users can view their own blocks"
  on public.blocked_users for select
  using (auth.uid() = user_id);

create policy "Users can create their own blocks"
  on public.blocked_users for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own blocks"
  on public.blocked_users for delete
  using (auth.uid() = user_id);

-- 3. user_reports: reportes de usuarios. Solo INSERT como uno mismo — sin policy de
-- SELECT para clientes normales a propósito (los reportes se revisan a mano desde el
-- SQL Editor, no hay panel de admin), así que por default nadie puede leerlos vía
-- PostgREST, ni siquiera el propio reporter. reported_user_id nunca se expone al
-- reportado por ningún otro camino tampoco (no hay ninguna vista ni query en el
-- frontend que lea esta tabla).
create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id),
  reported_user_id uuid not null references auth.users(id),
  reason text not null check (reason in ('spam', 'scam', 'harassment', 'other')),
  details text,
  created_at timestamptz not null default now()
);

alter table public.user_reports enable row level security;

create policy "Users can create their own reports"
  on public.user_reports for insert
  with check (auth.uid() = reporter_id);
