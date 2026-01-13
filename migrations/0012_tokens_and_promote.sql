alter table "users"
  add column if not exists "tokens_balance" integer not null default 1;

alter table "annonces"
  add column if not exists "promotion" jsonb;




