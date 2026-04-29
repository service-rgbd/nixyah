alter table "users"
  add column if not exists "login_link_token" text,
  add column if not exists "login_link_expires_at" timestamp with time zone,
  add column if not exists "login_link_sent_at" timestamp with time zone;
