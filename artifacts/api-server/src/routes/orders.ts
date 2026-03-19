import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, chefProfilesTable, usersTable, dishesTable, deliveryJobsTable, deliveryLocationUpdatesTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireClient, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/orders", requireClient, async (req: AuthRequest, res) => {
  try {
    const orders = await db
      .select()
      .from(ordersTable)
      .innerJoin(chefProfilesTable, eq(ordersTable.chefProfileId, chefProfilesTable.id))
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id))
      .where(eq(ordersTable.clientId, req.userId!));

    const result = await Promise.all(
      orders.map(async ({ orders: o, users: u }) => {
        const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));
        const [deliveryJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, o.id)).limit(1);
        const [latestLocation] = deliveryJob
          ? await db
              .select()
              .from(deliveryLocationUpdatesTable)
              .where(eq(deliveryLocationUpdatesTable.deliveryJobId, deliveryJob.id))
              .limit(1)
          : [];
        return {
          id: String(o.id),
          clientId: String(o.clientId),
          chefId: String(o.chefProfileId),
          chefName: u.name,
          status: o.status,
          total: o.total,
          occasion: o.occasion,
          persons: o.persons,
          notes: o.notes,
          createdAt: o.createdAt.toISOString(),
          delivery: deliveryJob
            ? {
                id: String(deliveryJob.id),
                status: deliveryJob.status,
                courierUserId: deliveryJob.courierUserId ? String(deliveryJob.courierUserId) : null,
                deliveryAddress: deliveryJob.deliveryAddress,
                restaurantAddress: deliveryJob.restaurantAddress,
                latestLocation: latestLocation
                  ? {
                      latitude: latestLocation.latitude,
                      longitude: latestLocation.longitude,
                      accuracy: latestLocation.accuracy,
                      heading: latestLocation.heading,
                      speed: latestLocation.speed,
                      createdAt: latestLocation.createdAt.toISOString(),
                    }
                  : null,
              }
            : null,
          items: items.map((i) => ({
            dishId: String(i.dishId ?? ""),
            dishName: i.dishName,
            quantity: i.quantity,
            price: i.price,
          })),
        };
      })
    );

    res.json({ orders: result });
  } catch (err) {
    console.error("list orders error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/orders", requireClient, async (req: AuthRequest, res) => {
  try {
    const { chefId, occasion, persons, budget, notes, items } = req.body;
    const parsedChefId = Number(chefId);
    const normalizedItems = Array.isArray(items) ? items : [];

    if (!Number.isInteger(parsedChefId) || parsedChefId <= 0) {
      res.status(400).json({ error: "BadRequest", message: "Cuisinière invalide" });
      return;
    }
    if (normalizedItems.length === 0) {
      res.status(400).json({ error: "BadRequest", message: "La commande doit contenir au moins un plat" });
      return;
    }

    const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, parsedChefId));
    if (!cp) {
      res.status(404).json({ error: "NotFound", message: "Cuisinière introuvable" });
      return;
    }

    const requestedDishIds = normalizedItems
      .map((item: any) => Number(item?.dishId))
      .filter((dishId: number) => Number.isInteger(dishId) && dishId > 0);

    if (requestedDishIds.length !== normalizedItems.length) {
      res.status(400).json({ error: "BadRequest", message: "Les plats de la commande sont invalides" });
      return;
    }

    const dishes = await db.select().from(dishesTable).where(inArray(dishesTable.id, requestedDishIds));
    if (dishes.length !== requestedDishIds.length) {
      res.status(400).json({ error: "BadRequest", message: "Un ou plusieurs plats sont introuvables" });
      return;
    }

    const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
    const invalidChefDish = dishes.some((dish) => dish.chefProfileId !== cp.id);
    if (invalidChefDish) {
      res.status(400).json({ error: "BadRequest", message: "Tous les plats doivent appartenir à la même cuisinière" });
      return;
    }

    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, cp.userId));
    const safeItems = normalizedItems.map((item: any) => {
      const dish = dishesById.get(Number(item.dishId));
      const quantity = Number(item.quantity);
      if (!dish || !Number.isInteger(quantity) || quantity <= 0) {
        return null;
      }
      return {
        dishId: dish.id,
        dishName: dish.name,
        quantity,
        price: dish.price,
      };
    });
    if (safeItems.some((item) => item === null)) {
      res.status(400).json({ error: "BadRequest", message: "Les quantités de commande sont invalides" });
      return;
    }
    const finalItems = safeItems.filter((item): item is NonNullable<typeof item> => item !== null);
    const total = finalItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const [order] = await db.insert(ordersTable).values({
      clientId: req.userId!,
      chefProfileId: cp.id,
      status: "pending",
      total,
      occasion: occasion || null,
      persons: persons ? Number(persons) : null,
      budget: budget || null,
      notes: notes || null,
    }).returning();

    if (finalItems.length > 0) {
      await db.insert(orderItemsTable).values(
        finalItems.map((item) => ({
          orderId: order.id,
          dishId: item.dishId,
          dishName: item.dishName,
          quantity: item.quantity,
          price: item.price,
        }))
      );
    }

    res.status(201).json({
      id: String(order.id),
      clientId: String(order.clientId),
      chefId: String(order.chefProfileId),
      chefName: u.name,
      status: order.status,
      total: order.total,
      occasion: order.occasion,
      persons: order.persons,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      items: finalItems,
    });
  } catch (err) {
    console.error("create order error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;
