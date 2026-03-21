import express from "express";
import { db } from "@workspace/db";
import { cartsTable, cartItemsTable, dishesTable, ordersTable, orderItemsTable, usersTable } from "@workspace/db/schema";
import { requireClient, type AuthRequest } from "../middlewares/auth.js";
import { and, eq, inArray } from "drizzle-orm";

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
    const dishId = Number(req.body.dishId);
    const quantity = Number(req.body.quantity ?? 1);

    if (!Number.isInteger(dishId) || dishId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "dishId invalide" });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Quantité invalide" });
    }

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
      const [updated] = await db
        .update(cartItemsTable)
        .set({ quantity: existingItem.quantity + quantity, dishName: dish.name, price: dish.price })
        .where(eq(cartItemsTable.id, existingItem.id))
        .returning();
      return res.status(200).json({ item: updated });
    }

    const [inserted] = await db
      .insert(cartItemsTable)
      .values({
        cartId: cart.id,
        dishId: dish.id,
        dishName: dish.name,
        price: dish.price,
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
    const itemId = Number(req.params.id);
    const { quantity } = req.body;
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Quantité invalide" });
    }

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
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Article invalide" });
    }

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
router.post("/cart/checkout", requireClient, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const deliveryAddress = typeof req.body?.deliveryAddress === "string" ? req.body.deliveryAddress.trim() : "";
    const deliveryLatitude = Number(req.body?.deliveryLatitude ?? NaN);
    const deliveryLongitude = Number(req.body?.deliveryLongitude ?? NaN);
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
        price: dish.price,
      };
    });

    const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const resolvedDeliveryAddress = deliveryAddress || clientUser?.location || "";

    const [order] = await db
      .insert(ordersTable)
      .values({
        clientId: userId,
        chefProfileId,
        total,
        deliveryAddress: resolvedDeliveryAddress || null,
        deliveryLatitude: Number.isFinite(deliveryLatitude) ? deliveryLatitude : null,
        deliveryLongitude: Number.isFinite(deliveryLongitude) ? deliveryLongitude : null,
      })
      .returning();

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

    return res.status(201).json({ orderId: order.id, total, deliveryAddress: resolvedDeliveryAddress || null });
  } catch (err) {
    console.error("checkout error", err);
    return res.status(500).json({ error: "InternalError" });
  }
});

export default router;
