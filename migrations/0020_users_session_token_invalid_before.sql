alter table "users"
  add column if not exists "session_token_invalid_before" timestamp with time zone;
