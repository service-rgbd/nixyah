-- Add profile visibility flag (user can decide if their profile is shown)

alter table "profiles"
  add column if not exists "visible" boolean not null default true;

create index if not exists "profiles_visible_idx" on "profiles" ("visible");



