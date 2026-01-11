-- Table for logging IPs and associated security metadata
create table if not exists "ip_logs" (
  "id" uuid primary key default gen_random_uuid(),
  "ip" varchar(64) not null,
  "user_id" uuid references "users"("id") on delete set null,
  "session_id" varchar(128),
  "user_agent" text,
  "method" varchar(16),
  "path" varchar(256),
  "kind" varchar(32),
  "country" varchar(64),
  "city" varchar(96),
  "lat" double precision,
  "lng" double precision,
  "accuracy" double precision,
  "created_at" timestamptz not null default now()
);

create index if not exists "ip_logs_ip_idx" on "ip_logs" ("ip");
create index if not exists "ip_logs_user_id_idx" on "ip_logs" ("user_id");
create index if not exists "ip_logs_kind_idx" on "ip_logs" ("kind");

-- Table for banning IPs or IP ranges (prefix-based)
create table if not exists "ip_bans" (
  "id" uuid primary key default gen_random_uuid(),
  "ip_pattern" varchar(64) not null,
  "reason" text,
  "banned_until" timestamptz,
  "created_at" timestamptz not null default now()
);

create index if not exists "ip_bans_ip_pattern_idx" on "ip_bans" ("ip_pattern");


