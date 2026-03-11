import { pgTable, text, serial, boolean, real, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userTypeEnum = pgEnum("user_type", ["client", "chef"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "accepted", "preparing", "ready", "delivered"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  type: userTypeEnum("type").notNull().default("client"),
  location: text("location").notNull().default(""),
  coverColor: text("cover_color").notNull().default("#C4522A"),
  preferences: text("preferences").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chefProfilesTable = pgTable("chef_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  specialty: text("specialty").notNull(),
  location: text("location").notNull(),
  zone: text("zone").notNull().default(""),
  bio: text("bio").notNull().default(""),
  rating: real("rating").notNull().default(5.0),
  reviewCount: integer("review_count").notNull().default(0),
  priceRange: text("price_range").notNull().default(""),
  isVerified: boolean("is_verified").notNull().default(false),
  isOnline: boolean("is_online").notNull().default(true),
  responseTime: text("response_time").notNull().default("< 30 min"),
  specialties: text("specialties").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dishesTable = pgTable("dishes", {
  id: serial("id").primaryKey(),
  chefProfileId: integer("chef_profile_id").notNull().references(() => chefProfilesTable.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: real("price").notNull(),
  category: text("category").notNull().default("Plats Principaux"),
  prepTime: text("prep_time").notNull().default("30 min"),
  isPopular: boolean("is_popular").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const storiesTable = pgTable("stories", {
  id: serial("id").primaryKey(),
  chefProfileId: integer("chef_profile_id").notNull().references(() => chefProfilesTable.id),
  caption: text("caption").notNull(),
  dishName: text("dish_name"),
  price: real("price"),
  emoji: text("emoji").default("🍲"),
  bgColor: text("bg_color").default("#C4522A"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => usersTable.id),
  chefProfileId: integer("chef_profile_id").notNull().references(() => chefProfilesTable.id),
  status: orderStatusEnum("status").notNull().default("pending"),
  total: real("total").notNull().default(0),
  occasion: text("occasion"),
  persons: integer("persons"),
  budget: text("budget"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  dishId: integer("dish_id").references(() => dishesTable.id),
  dishName: text("dish_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: real("price").notNull(),
});

export const chatsTable = pgTable("chats", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => usersTable.id),
  chefProfileId: integer("chef_profile_id").notNull().references(() => chefProfilesTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chatsTable.id),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertChefProfileSchema = createInsertSchema(chefProfilesTable).omit({ id: true, createdAt: true });
export const insertDishSchema = createInsertSchema(dishesTable).omit({ id: true, createdAt: true });
export const insertStorySchema = createInsertSchema(storiesTable).omit({ id: true });
export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ChefProfile = typeof chefProfilesTable.$inferSelect;
export type InsertChefProfile = z.infer<typeof insertChefProfileSchema>;
export type Dish = typeof dishesTable.$inferSelect;
export type Story = typeof storiesTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
