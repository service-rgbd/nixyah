import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, chefProfilesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/orders", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/orders", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { chefId, occasion, persons, budget, notes, items } = req.body;

    const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, parseInt(chefId)));
    if (!cp) {
      res.status(404).json({ error: "NotFound", message: "Cuisinière introuvable" });
      return;
    }

    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, cp.userId));
    const total = items ? items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0) : 0;

    const [order] = await db.insert(ordersTable).values({
      clientId: req.userId!,
      chefProfileId: cp.id,
      status: "pending",
      total,
      occasion: occasion || null,
      persons: persons || null,
      budget: budget || null,
      notes: notes || null,
    }).returning();

    if (items && items.length > 0) {
      await db.insert(orderItemsTable).values(
        items.map((i: any) => ({
          orderId: order.id,
          dishName: i.dishName,
          quantity: i.quantity,
          price: i.price,
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
      items: items || [],
    });
  } catch (err) {
    console.error("create order error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;
