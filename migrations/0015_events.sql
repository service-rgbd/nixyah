do $$ begin
  create type "event_visibility" as enum ('public', 'private');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type "event_price_type" as enum ('free', 'paid');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type "event_status" as enum ('draft', 'published', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type "event_payment_status" as enum ('not_required', 'pending', 'paid', 'failed');
exception
  when duplicate_object then null;
end $$;

alter table "payments"
  alter column "user_id" drop not null;

create table if not exists "events" (
  "id" uuid primary key default gen_random_uuid(),
  "owner_profile_id" uuid not null references "profiles"("id") on delete cascade,
  "title" varchar(180) not null,
  "description" text,
  "city" varchar(128) not null,
  "venue" varchar(255),
  "starts_at" timestamptz not null,
  "ends_at" timestamptz,
  "visibility" "event_visibility" not null default 'public',
  "price_type" "event_price_type" not null default 'free',
  "price_amount" integer,
  "price_currency" varchar(8) not null default 'XOF',
  "capacity" integer,
  "contact_whatsapp" varchar(32),
  "contact_email" varchar(160),
  "image_url" text,
  "publication_credits_charged" integer not null default 15,
  "legal_notice_accepted" boolean not null default false,
  "status" "event_status" not null default 'draft',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "events_owner_profile_id_created_at_idx"
  on "events"("owner_profile_id", "created_at" desc);

create index if not exists "events_status_starts_at_idx"
  on "events"("status", "starts_at" desc);

create table if not exists "event_registrations" (
  "id" uuid primary key default gen_random_uuid(),
  "event_id" uuid not null references "events"("id") on delete cascade,
  "user_id" uuid references "users"("id") on delete set null,
  "guest_name" varchar(80) not null,
  "guest_email" varchar(160) not null,
  "guest_phone" varchar(32),
  "guest_whatsapp" varchar(32),
  "payment_status" "event_payment_status" not null default 'not_required',
  "payment_ref" varchar(255),
  "receipt_number" varchar(64),
  "receipt_sent_at" timestamptz,
  "amount" integer,
  "currency" varchar(8),
  "notify_by_email" boolean not null default true,
  "notify_by_whatsapp" boolean not null default false,
  "agreed_no_refund" boolean not null default false,
  "agreed_disclaimer" boolean not null default false,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "event_registrations_event_id_created_at_idx"
  on "event_registrations"("event_id", "created_at" desc);

create unique index if not exists "event_registrations_event_id_guest_email_uq"
  on "event_registrations"("event_id", lower("guest_email"));
