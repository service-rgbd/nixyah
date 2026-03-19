import { pgTable, text, serial, boolean, real, integer, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userTypeEnum = pgEnum("user_type", ["client", "chef", "courier"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "accepted", "preparing", "ready", "delivered"]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "broadcasting",
  "available",
  "accepted",
  "picked_up",
  "on_the_way",
  "delivered",
  "cancelled",
]);
export const deliveryOfferStatusEnum = pgEnum("delivery_offer_status", ["pending", "accepted", "rejected", "expired"]);

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    emailConfirmed: boolean("email_confirmed").notNull().default(false),
    emailConfirmToken: text("email_confirm_token"),
    emailConfirmExpires: timestamp("email_confirm_expires"),
    passwordHash: text("password_hash").notNull(),
    type: userTypeEnum("type").notNull().default("client"),
    location: text("location").notNull().default(""),
    coverColor: text("cover_color").notNull().default("#C4522A"),
    avatarUrl: text("avatar_url"),
    preferences: text("preferences").array().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    phoneUnique: uniqueIndex("users_phone_unique").on(table.phone),
  }),
);

export const chefProfilesTable = pgTable(
  "chef_profiles",
  {
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
  },
  (table) => ({
    userUnique: uniqueIndex("chef_profiles_user_id_unique").on(table.userId),
  }),
);

export const courierProfilesTable = pgTable(
  "courier_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    zone: text("zone").notNull().default(""),
    vehicleType: text("vehicle_type").notNull().default("moto"),
    isAvailable: boolean("is_available").notNull().default(true),
    isVerified: boolean("is_verified").notNull().default(false),
    currentLatitude: real("current_latitude"),
    currentLongitude: real("current_longitude"),
    lastLocationAt: timestamp("last_location_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("courier_profiles_user_id_unique").on(table.userId),
  }),
);

export const dishesTable = pgTable("dishes", {
  id: serial("id").primaryKey(),
  chefProfileId: integer("chef_profile_id").notNull().references(() => chefProfilesTable.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: real("price").notNull(),
  category: text("category").notNull().default("Plats Principaux"),
  prepTime: text("prep_time").notNull().default("30 min"),
  isPopular: boolean("is_popular").notNull().default(false),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const storiesTable = pgTable("stories", {
  id: serial("id").primaryKey(),
  chefProfileId: integer("chef_profile_id").notNull().references(() => chefProfilesTable.id),
  caption: text("caption").notNull(),
  imageUrl: text("image_url"),
  dishId: integer("dish_id").references(() => dishesTable.id),
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

export const deliveryJobsTable = pgTable(
  "delivery_jobs",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => ordersTable.id),
    chefProfileId: integer("chef_profile_id").notNull().references(() => chefProfilesTable.id),
    clientId: integer("client_id").notNull().references(() => usersTable.id),
    courierUserId: integer("courier_user_id").references(() => usersTable.id),
    status: deliveryStatusEnum("status").notNull().default("broadcasting"),
    restaurantName: text("restaurant_name").notNull(),
    restaurantAddress: text("restaurant_address").notNull(),
    restaurantLatitude: real("restaurant_latitude"),
    restaurantLongitude: real("restaurant_longitude"),
    clientName: text("client_name").notNull(),
    deliveryAddress: text("delivery_address").notNull(),
    deliveryLatitude: real("delivery_latitude"),
    deliveryLongitude: real("delivery_longitude"),
    notes: text("notes"),
    broadcastedAt: timestamp("broadcasted_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
    pickedUpAt: timestamp("picked_up_at"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderUnique: uniqueIndex("delivery_jobs_order_id_unique").on(table.orderId),
  }),
);

export const deliveryOffersTable = pgTable(
  "delivery_offers",
  {
    id: serial("id").primaryKey(),
    deliveryJobId: integer("delivery_job_id").notNull().references(() => deliveryJobsTable.id),
    courierUserId: integer("courier_user_id").notNull().references(() => usersTable.id),
    status: deliveryOfferStatusEnum("status").notNull().default("pending"),
    notifiedAt: timestamp("notified_at").defaultNow().notNull(),
    respondedAt: timestamp("responded_at"),
  },
  (table) => ({
    jobCourierUnique: uniqueIndex("delivery_offers_job_id_courier_id_unique").on(table.deliveryJobId, table.courierUserId),
  }),
);

export const deliveryLocationUpdatesTable = pgTable("delivery_location_updates", {
  id: serial("id").primaryKey(),
  deliveryJobId: integer("delivery_job_id").notNull().references(() => deliveryJobsTable.id),
  courierUserId: integer("courier_user_id").notNull().references(() => usersTable.id),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  accuracy: real("accuracy"),
  heading: real("heading"),
  speed: real("speed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatsTable = pgTable(
  "chats",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull().references(() => usersTable.id),
    chefProfileId: integer("chef_profile_id").notNull().references(() => chefProfilesTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    clientChefUnique: uniqueIndex("chats_client_id_chef_profile_id_unique").on(table.clientId, table.chefProfileId),
  }),
);

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chatsTable.id),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationType = pgEnum("notification_type", ["order", "review", "message", "payment", "system"]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: notificationType("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  orderId: integer("order_id").references(() => ordersTable.id),
  deliveryJobId: integer("delivery_job_id").references(() => deliveryJobsTable.id),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviewsTable = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => ordersTable.id),
    clientId: integer("client_id").notNull().references(() => usersTable.id),
    chefProfileId: integer("chef_profile_id").notNull().references(() => chefProfilesTable.id),
    rating: real("rating").notNull(),
    comment: text("comment").default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderUnique: uniqueIndex("reviews_order_id_unique").on(table.orderId),
  }),
);

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  platform: text("platform").notNull().default("web"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptionsTable).omit({ id: true, createdAt: true });
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;

export const cartsTable = pgTable(
  "carts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("carts_user_id_unique").on(table.userId),
  }),
);

export const cartItemsTable = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: integer("cart_id").notNull().references(() => cartsTable.id),
  dishId: integer("dish_id").references(() => dishesTable.id),
  dishName: text("dish_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: real("price").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCartSchema = createInsertSchema(cartsTable).omit({ id: true, createdAt: true });
export const insertCartItemSchema = createInsertSchema(cartItemsTable).omit({ id: true, createdAt: true });

export const storyLikesTable = pgTable(
  "story_likes",
  {
    id: serial("id").primaryKey(),
    storyId: integer("story_id").notNull().references(() => storiesTable.id),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    storyUserUnique: uniqueIndex("story_likes_story_id_user_id_unique").on(table.storyId, table.userId),
  }),
);

export const insertStoryLikeSchema = createInsertSchema(storyLikesTable).omit({ id: true, createdAt: true });
export type Cart = typeof cartsTable.$inferSelect;
export type CartItem = typeof cartItemsTable.$inferSelect;
export type StoryLike = typeof storyLikesTable.$inferSelect;

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertChefProfileSchema = createInsertSchema(chefProfilesTable).omit({ id: true, createdAt: true });
export const insertCourierProfileSchema = createInsertSchema(courierProfilesTable).omit({ id: true, createdAt: true });
export const insertDishSchema = createInsertSchema(dishesTable).omit({ id: true, createdAt: true });
export const insertStorySchema = createInsertSchema(storiesTable).omit({ id: true });
export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true });
export const insertDeliveryJobSchema = createInsertSchema(deliveryJobsTable).omit({ id: true, createdAt: true, broadcastedAt: true, acceptedAt: true, pickedUpAt: true, deliveredAt: true });
export const insertDeliveryOfferSchema = createInsertSchema(deliveryOffersTable).omit({ id: true, notifiedAt: true, respondedAt: true });
export const insertDeliveryLocationUpdateSchema = createInsertSchema(deliveryLocationUpdatesTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ChefProfile = typeof chefProfilesTable.$inferSelect;
export type InsertChefProfile = z.infer<typeof insertChefProfileSchema>;
export type CourierProfile = typeof courierProfilesTable.$inferSelect;
export type InsertCourierProfile = z.infer<typeof insertCourierProfileSchema>;
export type Dish = typeof dishesTable.$inferSelect;
export type Story = typeof storiesTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type Review = typeof reviewsTable.$inferSelect;
export type DeliveryJob = typeof deliveryJobsTable.$inferSelect;
export type DeliveryOffer = typeof deliveryOffersTable.$inferSelect;
export type DeliveryLocationUpdate = typeof deliveryLocationUpdatesTable.$inferSelect;
