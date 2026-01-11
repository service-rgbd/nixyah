alter table "profiles"
  add column if not exists "account_type" varchar(32) not null default 'profile';


