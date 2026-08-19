-- Página pública de estado (/status), actualizada a mano por el desarrollador desde
-- el SQL Editor de Supabase — no hay monitoreo automático ni UI de admin: es
-- deliberadamente así de simple, un solo valor de "estado actual", no un historial.

create table public.site_status (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('operational', 'degraded', 'maintenance', 'down')),
  message text,
  updated_at timestamptz not null default now()
);

-- Fila inicial: una sola fila activa a la vez. Si en el futuro se necesita historial,
-- esta tabla pasaría a ser append-only con un flag `is_current`, pero eso es más
-- complejidad de la que pide este alcance — hoy alcanza con "la fila más reciente por
-- updated_at" (así la lee app/status/page.tsx), que también tolera bien un UPDATE in
-- place de esta misma fila en vez de insertar una nueva cada vez que cambia el estado.
insert into public.site_status (status, message) values ('operational', null);

alter table public.site_status enable row level security;

-- Lectura pública, sin sesión — es una página de estado, tiene que poder verla
-- cualquiera. Ningún insert/update/delete desde el cliente: no se otorga ninguna
-- policy para esas operaciones ni se hace ningún grant a `authenticated`/`anon` más
-- allá de select, así que la única forma de escribir acá es a mano desde el SQL
-- Editor de Supabase con la cuenta de owner (que salta RLS).
create policy "Cualquiera puede ver el estado del sitio"
on public.site_status
for select
to anon, authenticated
using (true);
