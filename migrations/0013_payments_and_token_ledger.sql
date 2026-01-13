-- Token ledger + payments (Stripe + future Mobile Money)

create table if not exists "token_transactions" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id") on delete cascade,
  -- positive = credit, negative = debit
  "delta" integer not null,
  "reason" varchar(64) not null,
  "meta" jsonb,
  "created_at" timestamptz not null default now()
);

create index if not exists "token_transactions_user_id_created_at_idx"
  on "token_transactions"("user_id", "created_at" desc);

create table if not exists "payments" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id") on delete cascade,
  "provider" varchar(32) not null, -- stripe | mobile_money | ...
  "provider_ref" varchar(255) not null, -- checkout_session_id, transaction_id, etc.
  "status" varchar(32) not null, -- created | paid | failed | cancelled | refunded
  "currency" varchar(8),
  "amount" integer, -- smallest unit (Stripe: cents; XOF has 0 decimals but keep int)
  "tokens" integer not null default 0,
  "items" jsonb, -- what was purchased (packageId, etc.)
  "raw_event_id" varchar(255), -- webhook event id (idempotence)
  "created_at" timestamptz not null default now(),
  "paid_at" timestamptz
);

create unique index if not exists "payments_provider_provider_ref_uq"
  on "payments"("provider", "provider_ref");

create unique index if not exists "payments_provider_raw_event_id_uq"
  on "payments"("provider", "raw_event_id")
  where "raw_event_id" is not null;


