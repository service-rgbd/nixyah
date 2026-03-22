import express from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { commerceStoresTable, merchantProfilesTable, usersTable } from "@workspace/db/schema";
import { requireAdmin, type AuthRequest } from "../middlewares/auth.js";

const router = express.Router();

router.get("/admin/commerce/stores", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const stores = status
      ? await db.select().from(commerceStoresTable).where(eq(commerceStoresTable.status, status as any)).orderBy(desc(commerceStoresTable.createdAt))
      : await db.select().from(commerceStoresTable).orderBy(desc(commerceStoresTable.createdAt));

    const enriched = await Promise.all(stores.map(async (store) => {
      if (!store.merchantProfileId) {
        return { ...store, merchantProfile: null, merchantUser: null };
      }
      const [merchantProfile] = await db.select().from(merchantProfilesTable).where(eq(merchantProfilesTable.id, store.merchantProfileId)).limit(1);
      const [merchantUser] = merchantProfile
        ? await db.select().from(usersTable).where(eq(usersTable.id, merchantProfile.userId)).limit(1)
        : [null];
      return { ...store, merchantProfile: merchantProfile ?? null, merchantUser: merchantUser ?? null };
    }));

    res.json({ stores: enriched });
  } catch (error) {
    console.error("admin list commerce stores error", error);
    res.status(500).json({ error: "InternalError" });
  }
});

router.post("/admin/commerce/stores/:storeId/status", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.storeId);
    const status = req.body?.status;
    const isActive = req.body?.isActive;
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Enseigne invalide" });
    }
    if (!["draft", "pending_review", "approved", "suspended", "rejected"].includes(status)) {
      return res.status(400).json({ error: "BadRequest", message: "Statut invalide" });
    }

    const [store] = await db.update(commerceStoresTable)
      .set({ status, isActive: typeof isActive === "boolean" ? isActive : status === "approved" })
      .where(eq(commerceStoresTable.id, storeId))
      .returning();

    if (!store) {
      return res.status(404).json({ error: "NotFound", message: "Enseigne introuvable" });
    }
    return res.json({ store });
  } catch (error) {
    console.error("admin update commerce store status error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

export default router;