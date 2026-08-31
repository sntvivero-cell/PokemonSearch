-- Aviso único (una sola vez por usuario) de que existen notificaciones por email, para
-- que nadie se entere de que están prendidas por default solo cuando le llega la
-- primera. Se guarda en `profiles` (no en localStorage, a diferencia del banner de
-- cookies) porque tiene que sobrevivir entre dispositivos/navegadores — es un dato de
-- cuenta, no de sesión de un browser puntual.
alter table public.profiles add column has_seen_notification_notice boolean not null default false;
