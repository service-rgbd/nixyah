import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { chefProfilesTable, customRequestsTable, dishesTable, usersTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireChef, requireClient, type AuthRequest } from "../middlewares/auth.js";
import { notifyUsers } from "../lib/notifications.js";

const router: IRouter = Router();

const ALLOWED_CHEF_STATUSES = new Set(["quoted", "accepted", "rejected", "cancelled"]);

function mapClientCustomRequest(row: {
  request: typeof customRequestsTable.$inferSelect;
  chefName: string;
  chefLocation: string;
}) {
  return {
    id: String(row.request.id),
    chefId: String(row.request.chefProfileId),
    chefName: row.chefName,
    chefLocation: row.chefLocation,
    packageDishId: row.request.packageDishId ? String(row.request.packageDishId) : null,
    packageName: row.request.packageName,
    packageDescription: row.request.packageDescription,
    unitPrice: Number(row.request.unitPrice ?? 0),
    estimatedPersons: Number(row.request.estimatedPersons ?? 1),
    estimatedTotal: Number(row.request.estimatedTotal ?? 0),
    occasion: row.request.occasion ?? "",
    budget: row.request.budget ?? "",
    preferences: row.request.preferences ?? [],
    storyReference: row.request.storyReference ?? "",
    deliveryAddress: row.request.deliveryAddress ?? "",
    notes: row.request.notes ?? "",
    chefResponse: row.request.chefResponse ?? "",
    status: row.request.status,
    respondedAt: row.request.respondedAt?.toISOString() ?? null,
    createdAt: row.request.createdAt.toISOString(),
    updatedAt: row.request.updatedAt.toISOString(),
  };
}

function mapChefCustomRequest(row: {
  request: typeof customRequestsTable.$inferSelect;
  clientName: string;
  clientLocation: string;
}) {
  return {
    id: String(row.request.id),
    clientId: String(row.request.clientId),
    clientName: row.clientName,
    clientLocation: row.clientLocation,
    packageDishId: row.request.packageDishId ? String(row.request.packageDishId) : null,
    packageName: row.request.packageName,
    packageDescription: row.request.packageDescription,
    unitPrice: Number(row.request.unitPrice ?? 0),
    estimatedPersons: Number(row.request.estimatedPersons ?? 1),
    estimatedTotal: Number(row.request.estimatedTotal ?? 0),
    occasion: row.request.occasion ?? "",
    budget: row.request.budget ?? "",
    preferences: row.request.preferences ?? [],
    storyReference: row.request.storyReference ?? "",
    deliveryAddress: row.request.deliveryAddress ?? "",
    notes: row.request.notes ?? "",
    chefResponse: row.request.chefResponse ?? "",
    status: row.request.status,
    respondedAt: row.request.respondedAt?.toISOString() ?? null,
    createdAt: row.request.createdAt.toISOString(),
    updatedAt: row.request.updatedAt.toISOString(),
  };
}

router.get("/custom-requests", requireClient, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        request: customRequestsTable,
        chefName: usersTable.name,
        chefLocation: chefProfilesTable.location,
      })
      .from(customRequestsTable)
      .innerJoin(chefProfilesTable, eq(customRequestsTable.chefProfileId, chefProfilesTable.id))
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id))
      .where(eq(customRequestsTable.clientId, req.userId!))
      .orderBy(desc(customRequestsTable.createdAt));

    res.json({ requests: rows.map(mapClientCustomRequest) });
  } catch (error) {
    console.error("list custom requests error:", error);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/custom-requests", requireClient, async (req: AuthRequest, res) => {
  try {
    const chefProfileId = Number(req.body?.chefId);
    const packageDishId = Number(req.body?.packageDishId);
    const estimatedPersons = Math.max(1, Number(req.body?.estimatedPersons ?? 1));
    const preferences = Array.isArray(req.body?.preferences)
      ? req.body.preferences.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    if (!Number.isInteger(chefProfileId) || chefProfileId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Cuisinière invalide" });
    }

    if (!Number.isInteger(packageDishId) || packageDishId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Formule invalide" });
    }

    const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, chefProfileId)).limit(1);
    if (!chefProfile) {
      return res.status(404).json({ error: "NotFound", message: "Cuisinière introuvable" });
    }

    const [packageDish] = await db.select().from(dishesTable).where(eq(dishesTable.id, packageDishId)).limit(1);
    if (!packageDish || packageDish.chefProfileId !== chefProfile.id || packageDish.category !== "Evenements") {
      return res.status(400).json({ error: "BadRequest", message: "Cette formule sur-mesure n'est pas disponible" });
    }

    const [chefUser] = await db.select().from(usersTable).where(eq(usersTable.id, chefProfile.userId)).limit(1);
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

    const unitPrice = Number(packageDish.price ?? 0);
    const estimatedTotal = Number(req.body?.estimatedTotal ?? unitPrice * estimatedPersons);
    const [request] = await db.insert(customRequestsTable).values({
      clientId: req.userId!,
      chefProfileId: chefProfile.id,
      packageDishId: packageDish.id,
      packageName: packageDish.name,
      packageDescription: packageDish.description ?? "",
      unitPrice,
      estimatedPersons,
      estimatedTotal,
      occasion: typeof req.body?.occasion === "string" ? req.body.occasion : null,
      budget: typeof req.body?.budget === "string" ? req.body.budget : null,
      preferences,
      storyReference: typeof req.body?.storyReference === "string" ? req.body.storyReference : null,
      deliveryAddress: typeof req.body?.deliveryAddress === "string" ? req.body.deliveryAddress : clientUser?.location ?? null,
      notes: typeof req.body?.notes === "string" ? req.body.notes : null,
    }).returning();

    await notifyUsers({
      userIds: [chefProfile.userId],
      type: "order",
      title: "Nouvelle demande sur-mesure",
      message: `${clientUser?.name ?? "Une cliente"} a envoyé une demande sur-mesure pour ${packageDish.name}.`,
      data: {
        screen: "orders",
        customRequestId: request.id,
      },
    });

    return res.status(201).json({ request: mapClientCustomRequest({ request, chefName: chefUser?.name ?? "Cuisinière", chefLocation: chefProfile.location }) });
  } catch (error) {
    console.error("create custom request error:", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/chef/custom-requests", requireChef, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        request: customRequestsTable,
        clientName: usersTable.name,
        clientLocation: usersTable.location,
      })
      .from(customRequestsTable)
      .innerJoin(usersTable, eq(customRequestsTable.clientId, usersTable.id))
      .where(eq(customRequestsTable.chefProfileId, req.chefProfileId!))
      .orderBy(desc(customRequestsTable.createdAt));

    res.json({ requests: rows.map(mapChefCustomRequest) });
  } catch (error) {
    console.error("chef list custom requests error:", error);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.patch("/chef/custom-requests/:requestId/status", requireChef, async (req: AuthRequest, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const status = typeof req.body?.status === "string" ? req.body.status : "";
    const chefResponse = typeof req.body?.chefResponse === "string" ? req.body.chefResponse.trim() : "";

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Demande invalide" });
    }

    if (!ALLOWED_CHEF_STATUSES.has(status)) {
      return res.status(400).json({ error: "BadRequest", message: "Statut invalide" });
    }

    const [request] = await db.select().from(customRequestsTable).where(eq(customRequestsTable.id, requestId)).limit(1);
    if (!request || request.chefProfileId !== req.chefProfileId) {
      return res.status(404).json({ error: "NotFound", message: "Demande introuvable" });
    }

    const [updatedRequest] = await db
      .update(customRequestsTable)
      .set({
        status: status as typeof customRequestsTable.$inferSelect.status,
        chefResponse: chefResponse || request.chefResponse,
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customRequestsTable.id, request.id))
      .returning();

    await notifyUsers({
      userIds: [request.clientId],
      type: "order",
      title: "Réponse à votre demande sur-mesure",
      message: `Votre demande ${updatedRequest.packageName} est maintenant ${status}.`,
      data: {
        screen: "orders",
        customRequestId: updatedRequest.id,
      },
    });

    return res.json({ request: updatedRequest });
  } catch (error) {
    console.error("update custom request status error:", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;