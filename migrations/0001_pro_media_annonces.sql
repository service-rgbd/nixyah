-- Add "pro" fields + media + annonces
-- Run after migrations/0000_init.sql (or integrate if you haven't run it yet).

-- Enum for media types
do $$
begin
  create type "media_type" as enum ('photo', 'video');
exception
  when duplicate_object then null;
end $$;

alter table "profiles"
  add column if not exists "is_pro" boolean not null default false,
  add column if not exists "tarif" varchar(32),
  add column if not exists "lieu" varchar(64),
  add column if not exists "services" text[],
  add column if not exists "description" text,
  add column if not exists "disponibilite" jsonb;

create table if not exists "profile_media" (
  "id" uuid primary key default gen_random_uuid(),
  "profile_id" uuid not null references "profiles"("id") on delete cascade,
  "type" "media_type" not null,
  "url" text not null,
  "key" text,
  "sort_order" integer not null default 0,
  "created_at" timestamptz not null default now()
);

create index if not exists "profile_media_profile_idx" on "profile_media" ("profile_id");
create index if not exists "profile_media_type_idx" on "profile_media" ("type");
create index if not exists "profile_media_profile_sort_idx" on "profile_media" ("profile_id", "sort_order");

create table if not exists "annonces" (
  "id" uuid primary key default gen_random_uuid(),
  "profile_id" uuid not null references "profiles"("id") on delete cascade,
  "title" varchar(120) not null,
  "body" text,
  "active" boolean not null default true,
  "created_at" timestamptz not null default now()
);

create index if not exists "annonces_profile_idx" on "annonces" ("profile_id");
create index if not exists "annonces_active_idx" on "annonces" ("active");

-- Useful discovery indexes
create index if not exists "profiles_is_pro_idx" on "profiles" ("is_pro");
create index if not exists "profiles_created_at_idx" on "profiles" ("created_at");


