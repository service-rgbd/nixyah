import express from "express";
import { db } from "@workspace/db";
import { cartsTable, cartItemsTable, chefProfilesTable, dishesTable, ordersTable, orderItemsTable, usersTable } from "@workspace/db/schema";
import { requireClient, type AuthRequest } from "../middlewares/auth.js";
import { and, eq, inArray } from "drizzle-orm";
import { getDishEffectivePrice } from "../lib/menu.js";
import { notifyUsers } from "../lib/notifications.js";
import { quoteDeliveryOrderPricing } from "../lib/fulfillment.js";
import { parseWithSchema, idParamSchema } from "../lib/validation.js";
import {
  cartAddItemBodySchema,
  cartUpdateItemBodySchema,
  checkoutBodySchema,
  deliveryQuoteBodySchema,
} from "../lib/request-schemas.js";

const router = express.Router();

async function getOrCreateCart(userId: number) {
  const carts = await db.select().from(cartsTable).where(eq(cartsTable.userId, userId)).limit(1);
  const existingCart = carts[0];
  if (existingCart) {
    return existingCart;
  }

  const [newCart] = await db.insert(cartsTable).values({ userId }).returning();
  return newCart;
}

async function getOwnedCartItem(userId: number, itemId: number) {
  const cart = await getOrCreateCart(userId);
  const items = await db
    .select()
    .from(cartItemsTable)
    .where(and(eq(cartItemsTable.id, itemId), eq(cartItemsTable.cartId, cart.id)))
    .limit(1);

  return { cart, item: items[0] ?? null };
}

// GET /api/cart - get current user's cart
router.get("/cart", requireClient, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const cart = await getOrCreateCart(userId);

    const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
    return res.json({ cart: { id: cart.id, items } });
  } catch (err) {
    console.error("get cart error", err);
    return res.status(500).json({ error: "InternalError" });
  }
});

// POST /api/cart/items - add item to cart
router.post("/cart/items", requireClient, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const parsedBody = parseWithSchema(cartAddItemBodySchema, req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const dishId = parsedBody.data.dishId;
    const quantity = parsedBody.data.quantity ?? 1;

    const [dish] = await db.select().from(dishesTable).where(eq(dishesTable.id, dishId)).limit(1);
    if (!dish) {
      return res.status(404).json({ error: "NotFound", message: "Plat introuvable" });
    }

    const cart = await getOrCreateCart(userId);
    const existingItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
    if (existingItems.length > 0) {
      const existingDishIds = existingItems
        .map((item) => item.dishId)
        .filter((value): value is number => typeof value === "number");

      if (existingDishIds.length !== existingItems.length) {
        return res.status(400).json({ error: "InvalidCart", message: "Panier invalide" });
      }

      const existingDishes = existingDishIds.length > 0
        ? await db.select().from(dishesTable).where(inArray(dishesTable.id, existingDishIds))
        : [];
      const chefIds = new Set(existingDishes.map((item) => item.chefProfileId));
      chefIds.add(dish.chefProfileId);
      if (chefIds.size > 1) {
        return res.status(400).json({
          error: "MultiChefCartNotAllowed",
          message: "Le panier ne peut contenir que les plats d'une seule cuisinière",
        });
      }
    }

    const [existingItem] = await db
      .select()
      .from(cartItemsTable)
      .where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.dishId, dish.id)))
      .limit(1);

    if (existingItem) {
      const effectivePrice = getDishEffectivePrice(dish);
      const [updated] = await db
        .update(cartItemsTable)
        .set({ quantity: existingItem.quantity + quantity, dishName: dish.name, price: effectivePrice })
        .where(eq(cartItemsTable.id, existingItem.id))
        .returning();
      return res.status(200).json({ item: updated });
    }

    const effectivePrice = getDishEffectivePrice(dish);
    const [inserted] = await db
      .insert(cartItemsTable)
      .values({
        cartId: cart.id,
        dishId: dish.id,
        dishName: dish.name,
        price: effectivePrice,
        quantity,
      })
      .returning();
    return res.status(201).json({ item: inserted });
  } catch (err) {
    console.error("add cart item error", err);
    return res.status(500).json({ error: "InternalError" });
  }
});

// PUT /api/cart/items/:id - update quantity
router.put("/cart/items/:id", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedItemId = parseWithSchema(idParamSchema, req.params.id);
    const parsedBody = parseWithSchema(cartUpdateItemBodySchema, req.body);
    if (!parsedItemId.success) {
      return res.status(400).json({ error: "BadRequest", message: "Article invalide" });
    }
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const itemId = parsedItemId.data;
    const parsedQuantity = parsedBody.data.quantity;

    const { item } = await getOwnedCartItem(req.userId!, itemId);
    if (!item) {
      return res.status(404).json({ error: "NotFound", message: "Article introuvable" });
    }

    await db.update(cartItemsTable).set({ quantity: parsedQuantity }).where(eq(cartItemsTable.id, itemId));
    return res.json({ ok: true });
  } catch (err) {
    console.error("update cart item error", err);
    return res.status(500).json({ error: "InternalError" });
  }
});

// DELETE /api/cart/items/:id
router.delete("/cart/items/:id", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedItemId = parseWithSchema(idParamSchema, req.params.id);
    if (!parsedItemId.success) {
      return res.status(400).json({ error: "BadRequest", message: "Article invalide" });
    }

    const itemId = parsedItemId.data;

    const { item } = await getOwnedCartItem(req.userId!, itemId);
    if (!item) {
      return res.status(404).json({ error: "NotFound", message: "Article introuvable" });
    }

    await db.delete(cartItemsTable).where(eq(cartItemsTable.id, itemId));
    return res.json({ ok: true });
  } catch (err) {
    console.error("delete cart item error", err);
    return res.status(500).json({ error: "InternalError" });
  }
});

// POST /api/cart/checkout - convert cart to order
router.post("/cart/quote", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedBody = parseWithSchema(deliveryQuoteBodySchema, req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const cart = await getOrCreateCart(req.userId!);
    const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
    if (!items.length) {
      return res.status(400).json({ error: "CartEmpty", message: "Le panier est vide" });
    }

    const dishIds = items
      .map((item) => item.dishId)
      .filter((value): value is number => typeof value === "number");
    const dishes = await db.select().from(dishesTable).where(inArray(dishesTable.id, dishIds));
    if (!dishes.length) {
      return res.status(400).json({ error: "InvalidCart", message: "Le panier ne contient plus de plats valides" });
    }

    const subtotal = dishes.reduce((sum, dish) => {
      const matchingItem = items.find((item) => item.dishId === dish.id);
      return sum + getDishEffectivePrice(dish) * Number(matchingItem?.quantity ?? 0);
    }, 0);
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const [chefProfile] = dishes[0]?.chefProfileId
      ? await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, dishes[0].chefProfileId)).limit(1)
      : [];
    const deliveryAddress = parsedBody.data.deliveryAddress;
    const deliveryLatitude = parsedBody.data.deliveryLatitude ?? null;
    const deliveryLongitude = parsedBody.data.deliveryLongitude ?? null;
    const quote = await quoteDeliveryOrderPricing({
      subtotal,
      restaurantAddress: chefProfile?.location ?? null,
      deliveryAddress: deliveryAddress ?? clientUser?.location ?? null,
      deliveryLatitude: deliveryLatitude ?? null,
      deliveryLongitude: deliveryLongitude ?? null,
      hasReferralCredit: (clientUser?.freeDeliveryCredits ?? 0) > 0,
    });

    return res.json(quote);
  } catch (err) {
    console.error("cart quote error", err);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.post("/cart/checkout", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedBody = parseWithSchema(checkoutBodySchema, req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const userId = req.userId!;
    const requestedDeliveryAddress = parsedBody.data.deliveryAddress;
    const notes = parsedBody.data.notes;
    const deliveryLatitude = parsedBody.data.deliveryLatitude ?? null;
    const deliveryLongitude = parsedBody.data.deliveryLongitude ?? null;
    const deliveryAddress = requestedDeliveryAddress ?? "";
    const cart = await getOrCreateCart(userId);
    if (!cart) return res.status(400).json({ error: "CartEmpty" });

    const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
    if (!items || items.length === 0) return res.status(400).json({ error: "CartEmpty" });

    const dishIds = items
      .map((item) => item.dishId)
      .filter((value): value is number => typeof value === "number");

    if (dishIds.length !== items.length) {
      return res.status(400).json({ error: "InvalidCart", message: "Le panier contient des plats invalides" });
    }

    const dishes = await db.select().from(dishesTable).where(inArray(dishesTable.id, dishIds));
    if (dishes.length !== dishIds.length) {
      return res.status(400).json({ error: "InvalidCart", message: "Le panier contient des plats supprimés" });
    }

    const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
    const chefIds = new Set(dishes.map((dish) => dish.chefProfileId));
    if (chefIds.size !== 1) {
      return res.status(400).json({
        error: "MultiChefCartNotAllowed",
        message: "Le panier ne peut contenir que les plats d'une seule cuisinière",
      });
    }

    const chefProfileId = dishes[0].chefProfileId;
    const normalizedItems = items.map((item) => {
      const dish = dishesById.get(item.dishId!);
      if (!dish) {
        throw new Error("Dish missing during checkout");
      }
      return {
        dishId: dish.id,
        dishName: dish.name,
        quantity: item.quantity,
        price: getDishEffectivePrice(dish),
      };
    });

    const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const resolvedDeliveryAddress = deliveryAddress || clientUser?.location || "";
    const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, chefProfileId)).limit(1);
    const pricing = await quoteDeliveryOrderPricing({
      subtotal: total,
      restaurantAddress: chefProfile?.location ?? null,
      deliveryAddress: resolvedDeliveryAddress || null,
      deliveryLatitude: Number.isFinite(deliveryLatitude) ? deliveryLatitude : null,
      deliveryLongitude: Number.isFinite(deliveryLongitude) ? deliveryLongitude : null,
      hasReferralCredit: (clientUser?.freeDeliveryCredits ?? 0) > 0,
    });
    const [order] = await db
      .insert(ordersTable)
      .values({
        clientId: userId,
        chefProfileId,
        total,
        deliveryFee: pricing.deliveryFee,
        totalWithDelivery: pricing.totalWithDelivery,
        deliveryDistanceKm: pricing.distanceKm,
        deliveryDemandMultiplier: pricing.demandMultiplier,
        freeDeliveryApplied: pricing.freeDeliveryApplied,
        referralCreditUsed: pricing.referralCreditWillBeUsed,
        deliveryAddress: resolvedDeliveryAddress || null,
        deliveryLatitude: Number.isFinite(deliveryLatitude) ? deliveryLatitude : null,
        deliveryLongitude: Number.isFinite(deliveryLongitude) ? deliveryLongitude : null,
        notes: notes || null,
      })
      .returning();

    if (pricing.referralCreditWillBeUsed && (clientUser?.freeDeliveryCredits ?? 0) > 0) {
      await db.update(usersTable).set({
        freeDeliveryCredits: Math.max(0, (clientUser?.freeDeliveryCredits ?? 0) - 1),
      }).where(eq(usersTable.id, userId));
    }

    for (const item of normalizedItems) {
      await db.insert(orderItemsTable).values({
        orderId: order.id,
        dishId: item.dishId,
        dishName: item.dishName,
        quantity: item.quantity,
        price: item.price,
      });
    }

    // clear cart
    await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));

    const [chefProfileOwner] = await db
      .select({ userId: usersTable.id, name: usersTable.name })
      .from(chefProfilesTable)
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id))
      .where(eq(chefProfilesTable.id, chefProfileId))
      .limit(1);

    if (chefProfileOwner?.userId) {
      await notifyUsers({
        userIds: [chefProfileOwner.userId],
        type: "order",
        title: "Nouvelle commande",
        message: `${clientUser?.name ?? "Une cliente"} a passé une nouvelle commande.`,
        orderId: order.id,
        data: {
          screen: "orders",
          orderId: String(order.id),
          total,
          deliveryFee: String(pricing.deliveryFee),
          totalWithDelivery: String(pricing.totalWithDelivery),
        },
      });
    }

    await notifyUsers({
      userIds: [userId],
      type: "order",
      title: "Commande enregistrée",
      message: "Votre commande a bien été enregistrée. Vous recevrez les prochaines étapes en temps réel.",
      orderId: order.id,
      data: {
        screen: "orders",
        orderId: String(order.id),
        deliveryFee: String(pricing.deliveryFee),
        totalWithDelivery: String(pricing.totalWithDelivery),
      },
    });
    return res.status(201).json({
      orderId: order.id,
      total,
      deliveryFee: pricing.deliveryFee,
      totalWithDelivery: pricing.totalWithDelivery,
      deliveryDistanceKm: pricing.distanceKm,
      demandMultiplier: pricing.demandMultiplier,
      freeDeliveryApplied: pricing.freeDeliveryApplied,
      referralCreditUsed: pricing.referralCreditWillBeUsed,
      deliveryAddress: resolvedDeliveryAddress || null,
      cancelAvailableUntil: new Date(order.createdAt.getTime() + 10_000).toISOString(),
    });
  } catch (err) {
    console.error("checkout error", err);
    return res.status(500).json({ error: "InternalError" });
  }
});

export default router;
