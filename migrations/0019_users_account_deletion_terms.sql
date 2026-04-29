alter table "users"
  add column if not exists "delete_requested_at" timestamp with time zone,
  add column if not exists "delete_scheduled_at" timestamp with time zone,
  add column if not exists "terms_accepted_at" timestamp with time zone,
  add column if not exists "terms_accepted_version" varchar(32);
