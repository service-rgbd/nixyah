import express from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  commerceOrderItemsTable,
  commerceOrdersTable,
  commerceProductsTable,
  commerceStoresTable,
  merchantProfilesTable,
} from "@workspace/db/schema";
import { requireMerchant, type AuthRequest } from "../middlewares/auth.js";

const router = express.Router();

async function requireOwnedStore(storeId: number, merchantProfileId: number) {
  const [store] = await db
    .select()
    .from(commerceStoresTable)
    .where(and(eq(commerceStoresTable.id, storeId), eq(commerceStoresTable.merchantProfileId, merchantProfileId)))
    .limit(1);
  return store ?? null;
}

router.get("/merchant/me", requireMerchant, async (req: AuthRequest, res) => {
  try {
    const [profile] = await db.select().from(merchantProfilesTable).where(eq(merchantProfilesTable.id, req.merchantProfileId!)).limit(1);
    res.json({ merchantProfile: profile ?? null });
  } catch (error) {
    console.error("merchant me error", error);
    res.status(500).json({ error: "InternalError" });
  }
});

router.get("/merchant/stores", requireMerchant, async (req: AuthRequest, res) => {
  try {
    const stores = await db
      .select()
      .from(commerceStoresTable)
      .where(eq(commerceStoresTable.merchantProfileId, req.merchantProfileId!))
      .orderBy(desc(commerceStoresTable.id));
    res.json({ stores });
  } catch (error) {
    console.error("merchant list stores error", error);
    res.status(500).json({ error: "InternalError" });
  }
});

router.post("/merchant/stores", requireMerchant, async (req: AuthRequest, res) => {
  try {
    const universe = req.body?.universe;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const location = typeof req.body?.location === "string" ? req.body.location.trim() : "";
    if ((universe !== "courses" && universe !== "supermarkets" && universe !== "boutiques") || !name || !location) {
      return res.status(400).json({ error: "BadRequest", message: "Univers, nom et localisation requis" });
    }

    const [store] = await db.insert(commerceStoresTable).values({
      merchantProfileId: req.merchantProfileId!,
      universe,
      name,
      tagline: typeof req.body?.tagline === "string" ? req.body.tagline.trim() : "",
      description: typeof req.body?.description === "string" ? req.body.description.trim() : "",
      location,
      zone: typeof req.body?.zone === "string" ? req.body.zone.trim() : "",
      accentColor: typeof req.body?.accentColor === "string" ? req.body.accentColor.trim() : "#C4522A",
      visualKey: typeof req.body?.visualKey === "string" ? req.body.visualKey.trim() : "",
      logoUrl: typeof req.body?.logoUrl === "string" ? req.body.logoUrl.trim() : null,
      bannerUrl: typeof req.body?.bannerUrl === "string" ? req.body.bannerUrl.trim() : null,
      etaMinMinutes: Number.isFinite(Number(req.body?.etaMinMinutes)) ? Number(req.body.etaMinMinutes) : 20,
      etaMaxMinutes: Number.isFinite(Number(req.body?.etaMaxMinutes)) ? Number(req.body.etaMaxMinutes) : 40,
      status: "pending_review",
      isActive: false,
    }).returning();

    return res.status(201).json({ store });
  } catch (error) {
    console.error("merchant create store error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.patch("/merchant/stores/:storeId", requireMerchant, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.storeId);
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Enseigne invalide" });
    }

    const ownedStore = await requireOwnedStore(storeId, req.merchantProfileId!);
    if (!ownedStore) {
      return res.status(404).json({ error: "NotFound", message: "Enseigne introuvable" });
    }

    const updates: Record<string, unknown> = {};
    for (const field of ["name", "tagline", "description", "location", "zone", "accentColor", "visualKey", "logoUrl", "bannerUrl"]) {
      if (typeof req.body?.[field] === "string") {
        updates[field] = req.body[field].trim();
      }
    }
    if (Number.isFinite(Number(req.body?.etaMinMinutes))) updates.etaMinMinutes = Number(req.body.etaMinMinutes);
    if (Number.isFinite(Number(req.body?.etaMaxMinutes))) updates.etaMaxMinutes = Number(req.body.etaMaxMinutes);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "BadRequest", message: "Aucun changement fourni" });
    }

    updates.status = ownedStore.status === "approved" ? "approved" : "pending_review";
    const [store] = await db.update(commerceStoresTable).set(updates).where(eq(commerceStoresTable.id, storeId)).returning();
    return res.json({ store });
  } catch (error) {
    console.error("merchant update store error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.get("/merchant/stores/:storeId/products", requireMerchant, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.storeId);
    const ownedStore = await requireOwnedStore(storeId, req.merchantProfileId!);
    if (!ownedStore) {
      return res.status(404).json({ error: "NotFound", message: "Enseigne introuvable" });
    }

    const products = await db.select().from(commerceProductsTable).where(eq(commerceProductsTable.storeId, storeId)).orderBy(desc(commerceProductsTable.id));
    return res.json({ store: ownedStore, products });
  } catch (error) {
    console.error("merchant store products error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.post("/merchant/stores/:storeId/products", requireMerchant, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.storeId);
    const ownedStore = await requireOwnedStore(storeId, req.merchantProfileId!);
    if (!ownedStore) {
      return res.status(404).json({ error: "NotFound", message: "Enseigne introuvable" });
    }
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return res.status(400).json({ error: "BadRequest", message: "Nom produit requis" });
    }

    const [product] = await db.insert(commerceProductsTable).values({
      storeId,
      name,
      description: typeof req.body?.description === "string" ? req.body.description.trim() : "",
      category: typeof req.body?.category === "string" ? req.body.category.trim() : "General",
      price: Number.isFinite(Number(req.body?.price)) ? Number(req.body.price) : 0,
      originalPrice: Number.isFinite(Number(req.body?.originalPrice)) ? Number(req.body.originalPrice) : null,
      badge: typeof req.body?.badge === "string" ? req.body.badge.trim() : null,
      unitLabel: typeof req.body?.unitLabel === "string" ? req.body.unitLabel.trim() : "",
      visualKey: typeof req.body?.visualKey === "string" ? req.body.visualKey.trim() : "",
      inStock: req.body?.inStock !== false,
    }).returning();

    return res.status(201).json({ product });
  } catch (error) {
    console.error("merchant create product error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.patch("/merchant/products/:productId", requireMerchant, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Produit invalide" });
    }

    const [product] = await db.select().from(commerceProductsTable).where(eq(commerceProductsTable.id, productId)).limit(1);
    if (!product) {
      return res.status(404).json({ error: "NotFound", message: "Produit introuvable" });
    }
    const ownedStore = await requireOwnedStore(product.storeId, req.merchantProfileId!);
    if (!ownedStore) {
      return res.status(404).json({ error: "NotFound", message: "Produit introuvable" });
    }

    const updates: Record<string, unknown> = {};
    for (const field of ["name", "description", "category", "badge", "unitLabel", "visualKey"]) {
      if (typeof req.body?.[field] === "string") {
        updates[field] = req.body[field].trim();
      }
    }
    if (Number.isFinite(Number(req.body?.price))) updates.price = Number(req.body.price);
    if (Number.isFinite(Number(req.body?.originalPrice))) updates.originalPrice = Number(req.body.originalPrice);
    if (typeof req.body?.inStock === "boolean") updates.inStock = req.body.inStock;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "BadRequest", message: "Aucun changement fourni" });
    }

    const [updatedProduct] = await db.update(commerceProductsTable).set(updates).where(eq(commerceProductsTable.id, productId)).returning();
    return res.json({ product: updatedProduct });
  } catch (error) {
    console.error("merchant update product error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.get("/merchant/stores/:storeId/orders", requireMerchant, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.storeId);
    const ownedStore = await requireOwnedStore(storeId, req.merchantProfileId!);
    if (!ownedStore) {
      return res.status(404).json({ error: "NotFound", message: "Enseigne introuvable" });
    }

    const orders = await db.select().from(commerceOrdersTable).where(eq(commerceOrdersTable.storeId, storeId)).orderBy(desc(commerceOrdersTable.createdAt));
    const enriched = await Promise.all(orders.map(async (order) => ({
      ...order,
      items: await db.select().from(commerceOrderItemsTable).where(eq(commerceOrderItemsTable.orderId, order.id)),
    })));
    return res.json({ store: ownedStore, orders: enriched });
  } catch (error) {
    console.error("merchant list orders error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

export default router;