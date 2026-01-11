-- Add preferred contact method (WhatsApp vs Telegram)

do $$ begin
  create type "contact_preference" as enum ('whatsapp', 'telegram');
exception
  when duplicate_object then null;
end $$;

alter table "profiles"
  add column if not exists "contact_preference" "contact_preference" not null default 'whatsapp';

create index if not exists "profiles_contact_preference_idx" on "profiles" ("contact_preference");



