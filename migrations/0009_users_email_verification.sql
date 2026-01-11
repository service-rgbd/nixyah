-- Add email verification & password reset columns on users

alter table "users"
  add column if not exists "email_verified" boolean not null default false,
  add column if not exists "email_verification_token" text,
  add column if not exists "email_verification_sent_at" timestamptz,
  add column if not exists "reset_password_token" text,
  add column if not exists "reset_password_expires_at" timestamptz;


