import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  doublePrecision,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const genderEnum = pgEnum("gender", ["homme", "femme"]);
export const mediaTypeEnum = pgEnum("media_type", ["photo", "video"]);
export const contactPreferenceEnum = pgEnum("contact_preference", ["whatsapp", "telegram"]);
export const salonTypeEnum = pgEnum("salon_type", ["spa", "private_massage", "residence", "adult_shop"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 160 }),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationSentAt: timestamp("email_verification_sent_at", { withTimezone: true }),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpiresAt: timestamp("reset_password_expires_at", { withTimezone: true }),
  passwordHash: text("password_hash").notNull(),
  tokensBalance: integer("tokens_balance").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),

  pseudo: varchar("pseudo", { length: 64 }).notNull().unique(),
  gender: genderEnum("gender").notNull(),
  age: integer("age").notNull(),
  ville: varchar("ville", { length: 128 }).notNull(),
  accountType: varchar("account_type", { length: 32 }).notNull().default("profile"),

  // Optional avatar/photo (can point to Cloudflare R2 public URL or a key)
  photoUrl: text("photo_url"),
  photoKey: text("photo_key"),

  // "Annonce" / mise en avant (champs utilisés dans Explore + fiche profil)
  isPro: boolean("is_pro").notNull().default(false),
  isVip: boolean("is_vip").notNull().default(false),
  visible: boolean("visible").notNull().default(true),

  // Optional contact details (only exposed publicly if flags enabled)
  phone: varchar("phone", { length: 32 }),
  showPhone: boolean("show_phone").notNull().default(false),
  telegram: varchar("telegram", { length: 64 }),
  showTelegram: boolean("show_telegram").notNull().default(false),
  contactPreference: contactPreferenceEnum("contact_preference").notNull().default("whatsapp"),

  // Optional location for nearby discovery (set from browser geolocation)
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),

  tarif: varchar("tarif", { length: 32 }),
  lieu: varchar("lieu", { length: 64 }),
  services: text("services").array(),
  description: text("description"),
  // Additional attributes for richer profiles/annonces
  corpulence: varchar("corpulence", { length: 32 }),
  poids: integer("poids"),
  // "Soumise / Dominatrice / Switch / ..."
  attitude: varchar("attitude", { length: 32 }),
  boireUnVerre: boolean("boire_un_verre"),
  fume: boolean("fume"),
  teintePeau: varchar("teinte_peau", { length: 32 }),
  traits: text("traits").array(),
  poitrine: varchar("poitrine", { length: 32 }),
  positions: text("positions").array(),
  selfDescriptions: text("self_descriptions").array(),
  disponibilite: jsonb("disponibilite").$type<{
    date: string;
    heureDebut: string;
    duree: string;
  }>(),

  showLocation: boolean("show_location").notNull().default(false),

  verified: boolean("verified").notNull().default(false),

  // Establishments (adult shop / spa / residence) extra fields
  businessName: varchar("business_name", { length: 160 }),
  address: varchar("address", { length: 255 }),
  openingHours: varchar("opening_hours", { length: 128 }),
  roomsCount: integer("rooms_count"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profileMedia = pgTable("profile_media", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  type: mediaTypeEnum("type").notNull(),
  url: text("url").notNull(),
  key: text("key"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const annonces = pgTable("annonces", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 120 }).notNull(),
  body: text("body"),
  promotion: jsonb("promotion"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salons = pgTable("salons", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: salonTypeEnum("type").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  ville: varchar("ville", { length: 128 }).notNull(),
  address: varchar("address", { length: 255 }),
  description: text("description"),
  openingHours: text("opening_hours"),
  mediaUrls: text("media_urls").array(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adultProductsTable = pgTable("adult_products", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "set null" }),
  ownerProfileId: uuid("owner_profile_id").references(() => profiles.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  subtitle: varchar("subtitle", { length: 200 }),
  price: varchar("price", { length: 64 }).notNull(),
  size: varchar("size", { length: 64 }),
  description: text("description"),
  imageUrl: text("image_url"),
  // Deprecated for UI (avoid categories display); keep for legacy/admin usage
  tag: varchar("tag", { length: 64 }),
  // Stock + delivery/pickup metadata
  stockQty: integer("stock_qty").notNull().default(0),
  placeType: varchar("place_type", { length: 32 }), // ex: delivery | pickup | discreet_meetup
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ipLogs = pgTable("ip_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ip: varchar("ip", { length: 64 }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id", { length: 128 }),
  userAgent: text("user_agent"),
  method: varchar("method", { length: 16 }),
  path: varchar("path", { length: 256 }),
  kind: varchar("kind", { length: 32 }),
  country: varchar("country", { length: 64 }),
  city: varchar("city", { length: 96 }),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  accuracy: doublePrecision("accuracy"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ipBans = pgTable("ip_bans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  // Can be an exact IP (ex: "102.67.201.171") or a prefix (ex: "102.67." to cover a range)
  ipPattern: varchar("ip_pattern", { length: 64 }).notNull(),
  reason: text("reason"),
  bannedUntil: timestamp("banned_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  passwordHash: true,
});

export const insertProfileSchema = createInsertSchema(profiles).pick({
  userId: true,
  pseudo: true,
  gender: true,
  age: true,
  ville: true,
  accountType: true,
  photoUrl: true,
  photoKey: true,
  visible: true,
  isVip: true,
  phone: true,
  showPhone: true,
  telegram: true,
  showTelegram: true,
  contactPreference: true,
  lat: true,
  lng: true,
  tarif: true,
  lieu: true,
  services: true,
  description: true,
  corpulence: true,
  poids: true,
  attitude: true,
  boireUnVerre: true,
  fume: true,
  teintePeau: true,
  traits: true,
  poitrine: true,
  positions: true,
  selfDescriptions: true,
  disponibilite: true,
  showLocation: true,
});

// Payload expected from the Signup UI
export const signupSchema = z.object({
  gender: z.enum(["homme", "femme"]),
  age: z.coerce.number().int().min(18).max(99),
  ville: z.string().min(1).max(128),
  lieu: z.string().min(1).max(64).optional(),
  accountType: z.enum(["profile", "residence", "salon", "adult_shop"]).optional(),
  // Identifiant de connexion (non affiché publiquement)
  username: z
    .string()
    .min(4)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Identifiant invalide"),
  // Pseudo public
  pseudo: z.string().min(2).max(64),
  password: z.string().min(6).max(200),
  email: z.string().email().max(160).optional(),
  // optional: can be sent after R2 upload later
  photoUrl: z.string().url().optional(),
  photoKey: z.string().min(1).optional(),
});

export const annonceCreateSchema = z.object({
  profileId: z.string().uuid(),
  title: z.string().min(2).max(120),
  body: z.string().max(5000).optional(),
  tarif: z.string().min(1).max(32).optional(),
  lieu: z.string().min(1).max(64).optional(),
  services: z.array(z.string().min(1).max(40)).max(20).optional(),
  description: z.string().max(5000).optional(),
  promote: z
    .object({
      extended: z
        .object({
          optionId: z.number().int().min(1).max(1000),
          paymentMode: z.enum(["tokens", "money"]),
        })
        .optional(),
      featured: z
        .object({
          optionId: z.number().int().min(1).max(1000),
        })
        .optional(),
      autorenew: z
        .object({
          optionId: z.number().int().min(1).max(1000),
        })
        .optional(),
      urgent: z
        .object({
          optionId: z.number().int().min(1).max(1000),
        })
        .optional(),
    })
    .optional(),
  corpulence: z.string().min(1).max(32).optional(),
  poids: z.coerce.number().int().min(30).max(300).optional(),
  attitude: z.string().min(1).max(32).optional(),
  boireUnVerre: z.boolean().optional(),
  fume: z.boolean().optional(),
  teintePeau: z.string().min(1).max(32).optional(),
  traits: z.array(z.string().min(1).max(40)).max(30).optional(),
  poitrine: z.string().min(1).max(32).optional(),
  positions: z.array(z.string().min(1).max(40)).max(30).optional(),
  selfDescriptions: z.array(z.string().min(1).max(40)).max(30).optional(),
  disponibilite: z
    .object({
      date: z.string().min(1).max(40),
      heureDebut: z.string().min(1).max(20),
      duree: z.string().min(1).max(20),
    })
    .optional(),
  media: z
    .array(
      z.object({
        type: z.enum(["photo", "video"]),
        url: z.string().url(),
        key: z.string().min(1).optional(),
        sortOrder: z.number().int().min(0).max(1000).optional(),
      }),
    )
    .max(50)
    .optional(),
});

export const insertSalonSchema = createInsertSchema(salons).pick({
  type: true,
  name: true,
  ville: true,
  address: true,
  description: true,
  openingHours: true,
  mediaUrls: true,
  lat: true,
  lng: true,
  active: true,
});

export const insertAdultProductSchema = createInsertSchema(adultProductsTable).pick({
  salonId: true,
  ownerProfileId: true,
  name: true,
  subtitle: true,
  price: true,
  size: true,
  description: true,
  imageUrl: true,
  tag: true,
  stockQty: true,
  placeType: true,
  active: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;
export type SignupPayload = z.infer<typeof signupSchema>;

export type AnnonceCreatePayload = z.infer<typeof annonceCreateSchema>;
export type ProfileMedia = typeof profileMedia.$inferSelect;
export type Annonce = typeof annonces.$inferSelect;
export type Salon = typeof salons.$inferSelect;
export type AdultProduct = typeof adultProductsTable.$inferSelect;
export type IpLog = typeof ipLogs.$inferSelect;
