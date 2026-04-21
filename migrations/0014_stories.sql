create type story_visibility as enum ('public', 'private');
create type story_sale_kind as enum ('none', 'video', 'product');

create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  visibility story_visibility not null default 'public',
  media_url text not null,
  media_key text,
  duration_seconds integer not null,
  caption varchar(280),
  sale_kind story_sale_kind not null default 'none',
  sale_title varchar(160),
  sale_price varchar(64),
  sale_description text,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists stories_profile_id_created_at_idx
  on stories(profile_id, created_at desc);

create index if not exists stories_visibility_active_expires_at_idx
  on stories(visibility, active, expires_at desc);