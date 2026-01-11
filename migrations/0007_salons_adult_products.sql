create type salon_type as enum ('spa', 'private_massage', 'residence', 'adult_shop');

create table if not exists salons (
  id uuid primary key default gen_random_uuid(),
  type salon_type not null,
  name varchar(160) not null,
  ville varchar(128) not null,
  address varchar(255),
  description text,
  opening_hours text,
  media_urls text[],
  lat double precision,
  lng double precision,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists adult_products (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references salons(id) on delete set null,
  name varchar(160) not null,
  subtitle varchar(200),
  price varchar(64) not null,
  size varchar(64),
  description text,
  image_url text,
  tag varchar(64),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists salons_type_active_idx on salons(type, active);
create index if not exists adult_products_active_idx on adult_products(active);




