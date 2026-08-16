-- "Busco ofertas" en el lado looking_for, sin pedir un Pokémon concreto. Valor del
-- POST completo — mismo patrón que is_spoofer y trinket_choice: se guarda duplicado
-- en todas las filas que comparten trade_group_id.
alter table user_trades add column open_to_offers boolean not null default false;
