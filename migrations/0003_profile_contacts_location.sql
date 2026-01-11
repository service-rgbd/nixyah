-- Add contact details + location coordinates to profiles

alter table "profiles"
  add column if not exists "phone" varchar(32),
  add column if not exists "show_phone" boolean not null default false,
  add column if not exists "telegram" varchar(64),
  add column if not exists "show_telegram" boolean not null default false,
  add column if not exists "lat" double precision,
  add column if not exists "lng" double precision;

create index if not exists "profiles_show_phone_idx" on "profiles" ("show_phone");
create index if not exists "profiles_show_telegram_idx" on "profiles" ("show_telegram");
create index if not exists "profiles_lat_lng_idx" on "profiles" ("lat", "lng");



