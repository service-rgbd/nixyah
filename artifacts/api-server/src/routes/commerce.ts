import express from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  commerceCartItemsTable,
  commerceCartsTable,
  commerceOrderItemsTable,
  commerceOrdersTable,
  commerceProductsTable,
  commerceStoresTable,
  usersTable,
} from "@workspace/db/schema";
import { requireClient, type AuthRequest } from "../middlewares/auth.js";
import { quoteDeliveryOrderPricing } from "../lib/fulfillment.js";
import { notifyUsers } from "../lib/notifications.js";
import { parseWithSchema, idParamSchema } from "../lib/validation.js";
import {
  checkoutBodySchema,
  commerceAddItemBodySchema,
  commerceUpdateItemBodySchema,
  deliveryQuoteBodySchema,
} from "../lib/request-schemas.js";

const router = express.Router();

async function getOrCreateCommerceCart(userId: number) {
  const existing = await db.select().from(commerceCartsTable).where(eq(commerceCartsTable.userId, userId)).limit(1);
  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db.insert(commerceCartsTable).values({ userId }).returning();
  return created;
}

async function buildCommerceCartPayload(userId: number) {
  const cart = await getOrCreateCommerceCart(userId);
  const items = await db.select().from(commerceCartItemsTable).where(eq(commerceCartItemsTable.cartId, cart.id)).orderBy(desc(commerceCartItemsTable.createdAt));
  const storeIds = Array.from(new Set(items.map((item) => item.storeId)));
  const stores = storeIds.length > 0
    ? await db.select().from(commerceStoresTable).where(inArray(commerceStoresTable.id, storeIds))
    : [];
  const storeById = new Map(stores.map((store) => [store.id, store]));
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  return {
    cartId: String(cart.id),
    store: items[0] ? storeById.get(items[0].storeId) ?? null : null,
    subtotal,
    itemCount: items.reduce((sum, item) => sum + Number(item.quantity), 0),
    items: items.map((item) => ({
      id: String(item.id),
      storeId: String(item.storeId),
      productId: String(item.productId),
      productName: item.productName,
      category: item.category,
      unitLabel: item.unitLabel,
      quantity: item.quantity,
      price: Number(item.price),
      visualKey: item.visualKey,
    })),
  };
}

router.get("/commerce/catalog", async (req, res) => {
  try {
    const rawUniverse = typeof req.query.universe === "string" ? req.query.universe.trim() : "";
    const universe = rawUniverse === "courses" || rawUniverse === "supermarkets" || rawUniverse === "boutiques"
      ? rawUniverse
      : null;

    const stores = universe
      ? await db.select().from(commerceStoresTable).where(and(eq(commerceStoresTable.universe, universe), eq(commerceStoresTable.isActive, true), eq(commerceStoresTable.status, "approved")))
      : await db.select().from(commerceStoresTable).where(and(eq(commerceStoresTable.isActive, true), eq(commerceStoresTable.status, "approved")));
    const storeIds = stores.map((store) => store.id);
    const products = storeIds.length > 0
      ? await db.select().from(commerceProductsTable).where(inArray(commerceProductsTable.storeId, storeIds))
      : [];

    return res.json({
      stores: stores.map((store) => ({
        id: String(store.id),
        universe: store.universe,
        name: store.name,
        tagline: store.tagline,
        description: store.description,
        location: store.location,
        zone: store.zone,
        accentColor: store.accentColor,
        visualKey: store.visualKey,
        logoUrl: store.logoUrl,
        bannerUrl: store.bannerUrl,
        etaMinMinutes: store.etaMinMinutes,
        etaMaxMinutes: store.etaMaxMinutes,
      })),
      products: products.map((product) => ({
        id: String(product.id),
        storeId: String(product.storeId),
        name: product.name,
        description: product.description,
        category: product.category,
        price: Number(product.price),
        originalPrice: product.originalPrice != null ? Number(product.originalPrice) : null,
        badge: product.badge,
        unitLabel: product.unitLabel,
        visualKey: product.visualKey,
        inStock: Boolean(product.inStock),
      })),
    });
  } catch (error) {
    console.error("commerce catalog error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.get("/commerce/cart", requireClient, async (req: AuthRequest, res) => {
  try {
    const payload = await buildCommerceCartPayload(req.userId!);
    return res.json({ cart: payload });
  } catch (error) {
    console.error("commerce get cart error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.post("/commerce/cart/items", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedBody = parseWithSchema(commerceAddItemBodySchema, req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const productId = parsedBody.data.productId;
    const quantity = parsedBody.data.quantity ?? 1;

    const [product] = await db.select().from(commerceProductsTable).where(eq(commerceProductsTable.id, productId)).limit(1);
    if (!product || !product.inStock) {
      return res.status(404).json({ error: "NotFound", message: "Produit introuvable" });
    }

    const [store] = await db.select().from(commerceStoresTable).where(eq(commerceStoresTable.id, product.storeId)).limit(1);
    if (!store || !store.isActive) {
      return res.status(404).json({ error: "NotFound", message: "Boutique introuvable" });
    }

    const cart = await getOrCreateCommerceCart(req.userId!);
    const existingItems = await db.select().from(commerceCartItemsTable).where(eq(commerceCartItemsTable.cartId, cart.id));

    if (existingItems.length > 0) {
      const storeIds = new Set(existingItems.map((item) => item.storeId));
      storeIds.add(store.id);
      if (storeIds.size > 1) {
        return res.status(400).json({
          error: "MultiStoreCartNotAllowed",
          message: "Le panier commerce ne peut contenir que les produits d'une seule enseigne",
        });
      }
    }

    const [existingItem] = await db
      .select()
      .from(commerceCartItemsTable)
      .where(and(eq(commerceCartItemsTable.cartId, cart.id), eq(commerceCartItemsTable.productId, product.id)))
      .limit(1);

    if (existingItem) {
      await db.update(commerceCartItemsTable)
        .set({
          quantity: existingItem.quantity + quantity,
          productName: product.name,
          category: product.category,
          unitLabel: product.unitLabel,
          price: Number(product.price),
          visualKey: product.visualKey,
        })
        .where(eq(commerceCartItemsTable.id, existingItem.id));
    } else {
      await db.insert(commerceCartItemsTable).values({
        cartId: cart.id,
        storeId: store.id,
        productId: product.id,
        productName: product.name,
        category: product.category,
        unitLabel: product.unitLabel,
        quantity,
        price: Number(product.price),
        visualKey: product.visualKey,
      });
    }

    const payload = await buildCommerceCartPayload(req.userId!);
    return res.status(201).json({ cart: payload });
  } catch (error) {
    console.error("commerce add cart item error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.put("/commerce/cart/items/:itemId", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedItemId = parseWithSchema(idParamSchema, req.params.itemId);
    const parsedBody = parseWithSchema(commerceUpdateItemBodySchema, req.body);
    if (!parsedItemId.success) {
      return res.status(400).json({ error: "BadRequest", message: "Article invalide" });
    }
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const itemId = parsedItemId.data;
    const quantity = parsedBody.data.quantity;

    const cart = await getOrCreateCommerceCart(req.userId!);
    const [item] = await db.select().from(commerceCartItemsTable).where(and(eq(commerceCartItemsTable.id, itemId), eq(commerceCartItemsTable.cartId, cart.id))).limit(1);
    if (!item) {
      return res.status(404).json({ error: "NotFound", message: "Article introuvable" });
    }

    await db.update(commerceCartItemsTable).set({ quantity }).where(eq(commerceCartItemsTable.id, itemId));
    const payload = await buildCommerceCartPayload(req.userId!);
    return res.json({ cart: payload });
  } catch (error) {
    console.error("commerce update cart item error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.delete("/commerce/cart/items/:itemId", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedItemId = parseWithSchema(idParamSchema, req.params.itemId);
    if (!parsedItemId.success) {
      return res.status(400).json({ error: "BadRequest", message: "Article invalide" });
    }

    const itemId = parsedItemId.data;

    const cart = await getOrCreateCommerceCart(req.userId!);
    const [item] = await db.select().from(commerceCartItemsTable).where(and(eq(commerceCartItemsTable.id, itemId), eq(commerceCartItemsTable.cartId, cart.id))).limit(1);
    if (!item) {
      return res.status(404).json({ error: "NotFound", message: "Article introuvable" });
    }

    await db.delete(commerceCartItemsTable).where(eq(commerceCartItemsTable.id, itemId));
    const payload = await buildCommerceCartPayload(req.userId!);
    return res.json({ cart: payload });
  } catch (error) {
    console.error("commerce delete cart item error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.post("/commerce/cart/quote", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedBody = parseWithSchema(deliveryQuoteBodySchema, req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const cart = await getOrCreateCommerceCart(req.userId!);
    const items = await db.select().from(commerceCartItemsTable).where(eq(commerceCartItemsTable.cartId, cart.id));
    if (!items.length) {
      return res.status(400).json({ error: "CartEmpty", message: "Le panier est vide" });
    }

    const [store] = await db.select().from(commerceStoresTable).where(eq(commerceStoresTable.id, items[0].storeId)).limit(1);
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const { deliveryAddress, deliveryLatitude, deliveryLongitude } = parsedBody.data;
    const quote = await quoteDeliveryOrderPricing({
      subtotal,
      restaurantAddress: store?.location ?? null,
      deliveryAddress: deliveryAddress ?? clientUser?.location ?? null,
      deliveryLatitude: deliveryLatitude ?? null,
      deliveryLongitude: deliveryLongitude ?? null,
      hasReferralCredit: false,
    });

    return res.json({ ...quote, subtotal, storeName: store?.name ?? null, universe: store?.universe ?? null });
  } catch (error) {
    console.error("commerce quote error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.post("/commerce/cart/checkout", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedBody = parseWithSchema(checkoutBodySchema, req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const userId = req.userId!;
    const cart = await getOrCreateCommerceCart(userId);
    const items = await db.select().from(commerceCartItemsTable).where(eq(commerceCartItemsTable.cartId, cart.id));
    if (!items.length) {
      return res.status(400).json({ error: "CartEmpty", message: "Le panier est vide" });
    }

    const storeIds = new Set(items.map((item) => item.storeId));
    if (storeIds.size !== 1) {
      return res.status(400).json({ error: "MultiStoreCartNotAllowed", message: "Le panier doit contenir une seule enseigne" });
    }

    const storeId = items[0].storeId;
    const [store] = await db.select().from(commerceStoresTable).where(eq(commerceStoresTable.id, storeId)).limit(1);
    if (!store) {
      return res.status(404).json({ error: "NotFound", message: "Enseigne introuvable" });
    }

    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const {
      deliveryAddress: requestedDeliveryAddress,
      notes,
      deliveryLatitude,
      deliveryLongitude,
    } = parsedBody.data;
    const deliveryAddress = requestedDeliveryAddress ?? clientUser?.location ?? "";
    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const pricing = await quoteDeliveryOrderPricing({
      subtotal,
      restaurantAddress: store.location,
      deliveryAddress: deliveryAddress || null,
      deliveryLatitude: deliveryLatitude ?? null,
      deliveryLongitude: deliveryLongitude ?? null,
      hasReferralCredit: false,
    });

    const [order] = await db.insert(commerceOrdersTable).values({
      clientId: userId,
      storeId: store.id,
      universe: store.universe,
      status: "pending",
      total: subtotal,
      deliveryFee: pricing.deliveryFee,
      totalWithDelivery: pricing.totalWithDelivery,
      deliveryDistanceKm: pricing.distanceKm,
      deliveryAddress: deliveryAddress || null,
      deliveryLatitude: deliveryLatitude ?? null,
      deliveryLongitude: deliveryLongitude ?? null,
      notes: notes || null,
    }).returning();

    await db.insert(commerceOrderItemsTable).values(
      items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        unitLabel: item.unitLabel,
        quantity: item.quantity,
        price: Number(item.price),
        visualKey: item.visualKey,
      })),
    );

    await db.delete(commerceCartItemsTable).where(eq(commerceCartItemsTable.cartId, cart.id));

    await notifyUsers({
      userIds: [userId],
      type: "order",
      title: "Commande commerce enregistree",
      message: `Votre commande chez ${store.name} a bien ete enregistree.`,
      data: {
        screen: "orders",
        orderId: `commerce:${order.id}`,
        universe: store.universe,
        totalWithDelivery: String(pricing.totalWithDelivery),
      },
    });

    return res.status(201).json({
      orderId: `commerce:${order.id}`,
      total: subtotal,
      deliveryFee: pricing.deliveryFee,
      totalWithDelivery: pricing.totalWithDelivery,
      deliveryDistanceKm: pricing.distanceKm,
      deliveryAddress: deliveryAddress || null,
    });
  } catch (error) {
    console.error("commerce checkout error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

export default router;