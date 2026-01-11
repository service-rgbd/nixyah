-- Initial schema for Neon (Postgres) / Drizzle
-- Safe to run in Neon SQL editor.

-- UUID generation used by `gen_random_uuid()`
create extension if not exists "pgcrypto";

-- Enum used by profiles
do $$
begin
  create type "gender" as enum ('homme', 'femme');
exception
  when duplicate_object then null;
end $$;

create table if not exists "users" (
  "id" uuid primary key default gen_random_uuid(),
  "username" varchar(64) not null unique,
  "password_hash" text not null,
  "created_at" timestamptz not null default now()
);

create table if not exists "profiles" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null unique references "users"("id") on delete cascade,
  "pseudo" varchar(64) not null unique,
  "gender" "gender" not null,
  "age" integer not null,
  "ville" varchar(128) not null,
  "photo_url" text,
  "photo_key" text,
  "verified" boolean not null default false,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

-- Helpful indexes (in addition to uniques)
create index if not exists "profiles_ville_idx" on "profiles" ("ville");
create index if not exists "profiles_verified_idx" on "profiles" ("verified");



