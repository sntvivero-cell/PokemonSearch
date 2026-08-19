-- "Guardados": permite marcar publicaciones de otros usuarios para encontrarlas
-- después, sin afectar user_trades ni su propio ciclo de vida (expiración/borrado).

create table public.saved_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- A propósito NO hay FK a user_trades.trade_group_id: ese id no es único por sí
  -- solo en user_trades (lo comparten varias filas del mismo post) y el post puede
  -- borrarse/expirar después de guardado — el caso esperado, no una excepción, así
  -- que la relación queda "suelta" y app/guardados/page.tsx resuelve en runtime si
  -- el trade_group_id guardado todavía tiene filas activas o no.
  trade_group_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, trade_group_id)
);

create index on public.saved_trades (user_id);

alter table public.saved_trades enable row level security;

create policy "Cada quien ve solo sus propios guardados"
on public.saved_trades
for select
to authenticated
using (auth.uid() = user_id);

create policy "Cada quien guarda solo como sí mismo"
on public.saved_trades
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Cada quien borra solo sus propios guardados"
on public.saved_trades
for delete
to authenticated
using (auth.uid() = user_id);

-- Sin policy de UPDATE a propósito (no pedida): sin ninguna policy para ese comando,
-- RLS lo deniega por completo aunque el rol tenga el GRANT por defecto de Supabase.
