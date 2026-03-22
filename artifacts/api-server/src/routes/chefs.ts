import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, chefProfilesTable, dishesTable, storiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getDishEffectivePrice, getDishSavingsAmount, normalizeChefMenuCategory, normalizeDiscountPercent, sanitizeDiscountLabel } from "../lib/menu.js";

const router: IRouter = Router();

router.get("/chefs", async (req, res) => {
  try {
    const profiles = await db
      .select()
      .from(chefProfilesTable)
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id));

    const chefs = await Promise.all(
      profiles.map(async ({ chef_profiles: cp, users: u }) => {
        const dishes = await db.select().from(dishesTable).where(eq(dishesTable.chefProfileId, cp.id));
        const stories = await db.select().from(storiesTable).where(eq(storiesTable.chefProfileId, cp.id));

        return {
          id: String(cp.id),
          userId: String(cp.userId),
          name: u.name,
          specialty: cp.specialty,
          location: cp.location,
          zone: cp.zone,
          bio: cp.bio,
          specialties: cp.specialties ?? [],
          rating: cp.rating,
          reviewCount: cp.reviewCount,
          stars: cp.stars ?? 0,
          complaintCount: cp.complaintCount ?? 0,
          activeInvestigationCount: cp.activeInvestigationCount ?? 0,
          isFeatured: Boolean(cp.isFeatured),
          priceRange: cp.priceRange,
          isVerified: cp.isVerified,
          isOnline: cp.isOnline,
          coverColor: u.coverColor,
          avatarUrl: u.avatarUrl ?? null,
          responseTime: cp.responseTime,
          dishes: dishes.map((d) => ({
            id: String(d.id),
            chefId: String(cp.id),
            name: d.name,
            description: d.description,
            imageUrl: d.imageUrl ?? null,
            imageUrls: d.imageUrls?.length ? d.imageUrls : d.imageUrl ? [d.imageUrl] : [],
            price: getDishEffectivePrice(d),
            basePrice: d.price,
            category: normalizeChefMenuCategory(d.category),
            prepTime: d.prepTime,
            isPopular: d.isPopular,
            discountPercent: normalizeDiscountPercent(d.discountPercent),
            discountLabel: sanitizeDiscountLabel(d.discountLabel),
            savingsAmount: getDishSavingsAmount(d),
          })),
          stories: stories.map((s) => ({
            id: String(s.id),
            chefId: String(cp.id),
            chefName: u.name,
            chefCoverColor: u.coverColor,
            imageUrl: s.imageUrl ?? null,
            videoUrl: s.videoUrl ?? null,
            videoDurationSeconds: s.videoDurationSeconds ?? null,
            caption: s.caption,
            dishName: s.dishName,
            price: s.price,
            emoji: s.emoji,
            bgColor: s.bgColor,
            createdAt: s.createdAt.toISOString(),
            expiresAt: s.expiresAt.toISOString(),
          })),
        };
      })
    );

    chefs.sort(
      (a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) ||
        Number(b.isOnline) - Number(a.isOnline) ||
        Number(b.isVerified) - Number(a.isVerified) ||
        b.rating - a.rating ||
        b.stars - a.stars ||
        b.reviewCount - a.reviewCount,
    );

    res.json({ chefs });
  } catch (err) {
    console.error("list chefs error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/chefs/:id", async (req, res) => {
  try {
    const chefId = parseInt(req.params.id);
    const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, chefId));
    if (!cp) {
      res.status(404).json({ error: "NotFound", message: "Cuisinière introuvable" });
      return;
    }

    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, cp.userId));
    const dishes = await db.select().from(dishesTable).where(eq(dishesTable.chefProfileId, cp.id));
    const stories = await db.select().from(storiesTable).where(eq(storiesTable.chefProfileId, cp.id));

    res.json({
      id: String(cp.id),
      userId: String(cp.userId),
      name: u.name,
      specialty: cp.specialty,
      location: cp.location,
      zone: cp.zone,
      bio: cp.bio,
      specialties: cp.specialties ?? [],
      rating: cp.rating,
      reviewCount: cp.reviewCount,
      stars: cp.stars ?? 0,
      complaintCount: cp.complaintCount ?? 0,
      activeInvestigationCount: cp.activeInvestigationCount ?? 0,
      isFeatured: Boolean(cp.isFeatured),
      priceRange: cp.priceRange,
      isVerified: cp.isVerified,
      isOnline: cp.isOnline,
      coverColor: u.coverColor,
      avatarUrl: u.avatarUrl ?? null,
      responseTime: cp.responseTime,
      dishes: dishes.map((d) => ({
        id: String(d.id),
        chefId: String(cp.id),
        name: d.name,
        description: d.description,
        imageUrl: d.imageUrl ?? null,
        imageUrls: d.imageUrls?.length ? d.imageUrls : d.imageUrl ? [d.imageUrl] : [],
        price: getDishEffectivePrice(d),
        basePrice: d.price,
        category: normalizeChefMenuCategory(d.category),
        prepTime: d.prepTime,
        isPopular: d.isPopular,
        discountPercent: normalizeDiscountPercent(d.discountPercent),
        discountLabel: sanitizeDiscountLabel(d.discountLabel),
        savingsAmount: getDishSavingsAmount(d),
      })),
      stories: stories.map((s) => ({
        id: String(s.id),
        chefId: String(cp.id),
        chefName: u.name,
        chefCoverColor: u.coverColor,
        imageUrl: s.imageUrl ?? null,
        videoUrl: s.videoUrl ?? null,
        videoDurationSeconds: s.videoDurationSeconds ?? null,
        caption: s.caption,
        dishName: s.dishName,
        price: s.price,
        emoji: s.emoji,
        bgColor: s.bgColor,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("get chef error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;
