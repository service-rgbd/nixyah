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
import { parseWithSchema, idParamSchema } from "../lib/validation.js";
import {
  merchantCreateProductSchema,
  merchantCreateStoreSchema,
  merchantUpdateProductSchema,
  merchantUpdateStoreSchema,
} from "../lib/request-schemas.js";

const router = express.Router();

async function requireOwnedStore(storeId: number, merchantProfileId: number) {
  const [store] = await db
    .select()
    .from(commerceStoresTable)
    .where(and(eq(commerceStoresTable.id, storeId), eq(commerceStoresTable.merchantProfileId, merchantProfileId)))
    .limit(1);
  return store ?? null;
}

function assertStoreCanMutateCatalog(status: typeof commerceStoresTable.$inferSelect.status) {
  return status !== "suspended" && status !== "rejected";
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
    const parsedBody = parseWithSchema(merchantCreateStoreSchema, req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const { universe, name, location, tagline, description, zone, accentColor, visualKey, logoUrl, bannerUrl, etaMinMinutes, etaMaxMinutes } = parsedBody.data;

    const [store] = await db.insert(commerceStoresTable).values({
      merchantProfileId: req.merchantProfileId!,
      universe,
      name,
      tagline: tagline ?? "",
      description: description ?? "",
      location,
      zone: zone ?? "",
      accentColor: accentColor ?? "#C4522A",
      visualKey: visualKey ?? "",
      logoUrl: logoUrl ?? null,
      bannerUrl: bannerUrl ?? null,
      etaMinMinutes: etaMinMinutes ?? 20,
      etaMaxMinutes: etaMaxMinutes ?? 40,
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
    const parsedStoreId = parseWithSchema(idParamSchema, req.params.storeId);
    const parsedBody = parseWithSchema(merchantUpdateStoreSchema, req.body);
    if (!parsedStoreId.success) {
      return res.status(400).json({ error: "BadRequest", message: "Enseigne invalide" });
    }
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const storeId = parsedStoreId.data;

    const ownedStore = await requireOwnedStore(storeId, req.merchantProfileId!);
    if (!ownedStore) {
      return res.status(404).json({ error: "NotFound", message: "Enseigne introuvable" });
    }

    const updates: Record<string, unknown> = {};
    const { name, tagline, description, location, zone, accentColor, visualKey, logoUrl, bannerUrl, etaMinMinutes, etaMaxMinutes } = parsedBody.data;
    if (name !== undefined) updates.name = name;
    if (tagline !== undefined) updates.tagline = tagline ?? "";
    if (description !== undefined) updates.description = description ?? "";
    if (location !== undefined) updates.location = location ?? "";
    if (zone !== undefined) updates.zone = zone ?? "";
    if (accentColor !== undefined) updates.accentColor = accentColor;
    if (visualKey !== undefined) updates.visualKey = visualKey ?? "";
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;
    if (etaMinMinutes !== undefined) updates.etaMinMinutes = etaMinMinutes;
    if (etaMaxMinutes !== undefined) updates.etaMaxMinutes = etaMaxMinutes;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "BadRequest", message: "Aucun changement fourni" });
    }

    updates.status = ownedStore.status === "approved" ? "approved" : "pending_review";
    if (updates.status !== "approved") {
      updates.isActive = false;
    }
    const [store] = await db.update(commerceStoresTable).set(updates).where(eq(commerceStoresTable.id, storeId)).returning();
    return res.json({ store });
  } catch (error) {
    console.error("merchant update store error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.get("/merchant/stores/:storeId/products", requireMerchant, async (req: AuthRequest, res) => {
  try {
    const parsedStoreId = parseWithSchema(idParamSchema, req.params.storeId);
    if (!parsedStoreId.success) {
      return res.status(400).json({ error: "BadRequest", message: "Enseigne invalide" });
    }
    const storeId = parsedStoreId.data;
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
    const parsedStoreId = parseWithSchema(idParamSchema, req.params.storeId);
    const parsedBody = parseWithSchema(merchantCreateProductSchema, req.body);
    if (!parsedStoreId.success) {
      return res.status(400).json({ error: "BadRequest", message: "Enseigne invalide" });
    }
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }
    const storeId = parsedStoreId.data;
    const ownedStore = await requireOwnedStore(storeId, req.merchantProfileId!);
    if (!ownedStore) {
      return res.status(404).json({ error: "NotFound", message: "Enseigne introuvable" });
    }
    if (!assertStoreCanMutateCatalog(ownedStore.status)) {
      return res.status(409).json({ error: "Conflict", message: "Cette enseigne doit etre revalidee avant d'ajouter des produits" });
    }
    const { name, description, category, price, originalPrice, badge, unitLabel, visualKey, inStock } = parsedBody.data;

    const [product] = await db.insert(commerceProductsTable).values({
      storeId,
      name,
      description: description ?? "",
      category: category ?? "General",
      price,
      originalPrice: originalPrice ?? null,
      badge: badge ?? null,
      unitLabel: unitLabel ?? "",
      visualKey: visualKey ?? "",
      inStock: inStock ?? true,
    }).returning();

    return res.status(201).json({ product });
  } catch (error) {
    console.error("merchant create product error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.patch("/merchant/products/:productId", requireMerchant, async (req: AuthRequest, res) => {
  try {
    const parsedProductId = parseWithSchema(idParamSchema, req.params.productId);
    const parsedBody = parseWithSchema(merchantUpdateProductSchema, req.body);
    if (!parsedProductId.success) {
      return res.status(400).json({ error: "BadRequest", message: "Produit invalide" });
    }
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const productId = parsedProductId.data;

    const [product] = await db.select().from(commerceProductsTable).where(eq(commerceProductsTable.id, productId)).limit(1);
    if (!product) {
      return res.status(404).json({ error: "NotFound", message: "Produit introuvable" });
    }
    const ownedStore = await requireOwnedStore(product.storeId, req.merchantProfileId!);
    if (!ownedStore) {
      return res.status(404).json({ error: "NotFound", message: "Produit introuvable" });
    }
    if (!assertStoreCanMutateCatalog(ownedStore.status)) {
      return res.status(409).json({ error: "Conflict", message: "Cette enseigne doit etre revalidee avant de modifier son catalogue" });
    }

    const updates: Record<string, unknown> = {};
    const { name, description, category, badge, unitLabel, visualKey, price, originalPrice, inStock } = parsedBody.data;
    if (name !== undefined) updates.name = name ?? "";
    if (description !== undefined) updates.description = description ?? "";
    if (category !== undefined) updates.category = category ?? "General";
    if (badge !== undefined) updates.badge = badge;
    if (unitLabel !== undefined) updates.unitLabel = unitLabel ?? "";
    if (visualKey !== undefined) updates.visualKey = visualKey ?? "";
    if (price !== undefined) updates.price = price;
    if (originalPrice !== undefined) updates.originalPrice = originalPrice;
    if (inStock !== undefined) updates.inStock = inStock;
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
    const parsedStoreId = parseWithSchema(idParamSchema, req.params.storeId);
    if (!parsedStoreId.success) {
      return res.status(400).json({ error: "BadRequest", message: "Enseigne invalide" });
    }
    const storeId = parsedStoreId.data;
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