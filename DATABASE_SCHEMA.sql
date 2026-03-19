-- ===================================================================
-- Nixyah Database Schema - Security Hardened
-- Execute this in Neon SQL Editor or psql
-- Source of truth remains Drizzle schema in lib/db/src/schema/index.ts
-- ===================================================================

DO $$
BEGIN
  CREATE TYPE user_type AS ENUM ('client', 'chef', 'courier');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'courier';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'accepted', 'preparing', 'ready', 'delivered');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE delivery_status AS ENUM ('broadcasting', 'available', 'accepted', 'picked_up', 'on_the_way', 'delivered', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE delivery_offer_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE notification_type AS ENUM ('order', 'review', 'message', 'payment', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  email_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  email_confirm_token TEXT,
  email_confirm_expires TIMESTAMP,
  password_hash TEXT NOT NULL,
  type user_type NOT NULL DEFAULT 'client',
  location TEXT NOT NULL DEFAULT '',
  cover_color TEXT NOT NULL DEFAULT '#C4522A',
  avatar_url TEXT,
  preferences TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users(phone);

CREATE TABLE IF NOT EXISTS chef_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialty TEXT NOT NULL,
  location TEXT NOT NULL,
  zone TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  rating REAL NOT NULL DEFAULT 5.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  price_range TEXT NOT NULL DEFAULT '',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_online BOOLEAN NOT NULL DEFAULT TRUE,
  response_time TEXT NOT NULL DEFAULT '< 30 min',
  specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS chef_profiles_user_id_unique ON chef_profiles(user_id);

CREATE TABLE IF NOT EXISTS courier_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone TEXT NOT NULL DEFAULT '',
  vehicle_type TEXT NOT NULL DEFAULT 'moto',
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  current_latitude REAL,
  current_longitude REAL,
  last_location_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS courier_profiles_user_id_unique ON courier_profiles(user_id);

CREATE TABLE IF NOT EXISTS dishes (
  id SERIAL PRIMARY KEY,
  chef_profile_id INTEGER NOT NULL REFERENCES chef_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'Plats Principaux',
  prep_time TEXT NOT NULL DEFAULT '30 min',
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stories (
  id SERIAL PRIMARY KEY,
  chef_profile_id INTEGER NOT NULL REFERENCES chef_profiles(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  image_url TEXT,
  dish_id INTEGER REFERENCES dishes(id) ON DELETE SET NULL,
  dish_name TEXT,
  price REAL,
  emoji TEXT DEFAULT '🍲',
  bg_color TEXT DEFAULT '#C4522A',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chef_profile_id INTEGER NOT NULL REFERENCES chef_profiles(id) ON DELETE CASCADE,
  status order_status NOT NULL DEFAULT 'pending',
  total REAL NOT NULL DEFAULT 0,
  occasion TEXT,
  persons INTEGER,
  budget TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id INTEGER REFERENCES dishes(id) ON DELETE SET NULL,
  dish_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_jobs (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  chef_profile_id INTEGER NOT NULL REFERENCES chef_profiles(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  courier_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status delivery_status NOT NULL DEFAULT 'broadcasting',
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT NOT NULL,
  restaurant_latitude REAL,
  restaurant_longitude REAL,
  client_name TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_latitude REAL,
  delivery_longitude REAL,
  notes TEXT,
  broadcasted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP,
  picked_up_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_jobs_order_id_unique ON delivery_jobs(order_id);

CREATE TABLE IF NOT EXISTS delivery_offers (
  id SERIAL PRIMARY KEY,
  delivery_job_id INTEGER NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
  courier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status delivery_offer_status NOT NULL DEFAULT 'pending',
  notified_at TIMESTAMP NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_offers_job_id_courier_id_unique ON delivery_offers(delivery_job_id, courier_user_id);

CREATE TABLE IF NOT EXISTS delivery_location_updates (
  id SERIAL PRIMARY KEY,
  delivery_job_id INTEGER NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
  courier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  heading REAL,
  speed REAL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chef_profile_id INTEGER NOT NULL REFERENCES chef_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS chats_client_id_chef_profile_id_unique ON chats(client_id, chef_profile_id);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  chef_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_job_id INTEGER REFERENCES delivery_jobs(id) ON DELETE SET NULL;
UPDATE notifications SET user_id = chef_id WHERE user_id IS NULL;
ALTER TABLE notifications ALTER COLUMN user_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chef_profile_id INTEGER NOT NULL REFERENCES chef_profiles(id) ON DELETE CASCADE,
  rating REAL NOT NULL,
  comment TEXT DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_id_unique ON reviews(order_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS carts_user_id_unique ON carts(user_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  dish_id INTEGER REFERENCES dishes(id) ON DELETE SET NULL,
  dish_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_likes (
  id SERIAL PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS story_likes_story_id_user_id_unique ON story_likes(story_id, user_id);
