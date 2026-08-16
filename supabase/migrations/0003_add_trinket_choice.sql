-- Trinket (objeto que aumenta la chance de intercambio con suerte), valor del POST
-- completo — mismo criterio que is_spoofer: se guarda duplicado en todas las filas
-- que comparten trade_group_id.
-- 'none'  = no se eligió ninguna opción (default).
-- 'self'  = el autor del post ofrece el trinket.
-- 'other' = el autor busca que la otra persona lo ofrezca.
alter table user_trades
  add column trinket_choice text not null default 'none'
  check (trinket_choice in ('none', 'self', 'other'));
