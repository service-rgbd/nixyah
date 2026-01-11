-- Adds additional profile attributes used for richer annonces/profile display.
-- Safe to run multiple times thanks to IF NOT EXISTS.

alter table profiles
  add column if not exists corpulence varchar(32),
  add column if not exists poids integer,
  add column if not exists attitude varchar(32),
  add column if not exists boire_un_verre boolean,
  add column if not exists fume boolean,
  add column if not exists teinte_peau varchar(32),
  add column if not exists traits text[],
  add column if not exists poitrine varchar(32),
  add column if not exists positions text[],
  add column if not exists self_descriptions text[];

create index if not exists profiles_traits_gin_idx on profiles using gin (traits);
create index if not exists profiles_positions_gin_idx on profiles using gin (positions);
create index if not exists profiles_self_descriptions_gin_idx on profiles using gin (self_descriptions);


