-- Elimina el botón "Actualizar" (bump) y unifica el cooldown de 30 min: antes vivía
-- en una policy RESTRICTIVE de UPDATE (solo la usaba el bump); ahora publicar y
-- editar son ambos, en el fondo, un INSERT (editar hace DELETE + INSERT), así que el
-- cooldown pasa a una única policy RESTRICTIVE de INSERT que cubre los dos casos.
--
-- PASO 0 (correr primero, no forma parte de la migración): no tenemos en este repo
-- el nombre exacto de la policy RESTRICTIVE de UPDATE actual — confirmalo con:
--
--   select policyname, cmd, permissive, qual, with_check
--   from pg_policies
--   where tablename = 'user_trades';
--
-- Reemplazá "<NOMBRE_EXACTO_DE_LA_POLICY>" más abajo por el valor real de
-- `policyname` que te devuelva esa consulta (la fila con cmd = 'UPDATE' y
-- permissive = false) antes de correr este archivo.

drop policy if exists "<NOMBRE_EXACTO_DE_LA_POLICY>" on public.user_trades;

-- Cooldown único de 30 min entre publicar un post nuevo o editar uno existente.
-- Se compara contra `updated_at` (no `created_at`): al editar, el INSERT reenvía el
-- created_at ORIGINAL a propósito (para que el post no salte al tope del feed como
-- si fuera nuevo), así que created_at no sirve para detectar "cuándo fue la última
-- vez que este usuario tocó algo" — updated_at sí, porque nunca se fuerza y siempre
-- queda en su default (now()) en cada INSERT, tanto al publicar como al editar.
--
-- La condición excluye las filas del propio trade_group_id que se está insertando:
-- un solo post inserta varias filas de una sola vez (hasta 10 'for_trade' + hasta 10
-- 'looking_for'), y también es el mismo trade_group_id que se vuelve a insertar al
-- editar (después de borrar las filas viejas de ese grupo). Sin esa exclusión, un
-- post con varios Pokémon podría autobloquearse, y editar el mismo post dos veces
-- seguidas quedaría indistinguible de publicar contenido nuevo.
--
-- Nota (léela antes de asumir el comportamiento): por esta misma exclusión, reeditar
-- EL MISMO post varias veces seguidas NO queda limitado por este cooldown entre sí
-- (las filas viejas de ese grupo ya no existen para cuando corre el nuevo INSERT, así
-- que no hay nada que comparar). El cooldown de 30 min aplica a tocar OTRO post
-- (publicar uno nuevo, o editar uno distinto) dentro de los 30 min posteriores a tu
-- última acción — no a re-guardar cambios menores en el post que ya estás editando.
create policy "Cooldown de 30 min entre publicar y editar"
on public.user_trades
as restrictive
for insert
to authenticated
with check (
  not exists (
    select 1
    from public.user_trades ut
    where ut.user_id = auth.uid()
      and ut.trade_group_id <> trade_group_id
      and ut.updated_at > now() - interval '30 minutes'
  )
);
