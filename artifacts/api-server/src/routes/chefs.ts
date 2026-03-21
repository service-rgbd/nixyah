import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, chefProfilesTable, dishesTable, storiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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
          rating: cp.rating,
          reviewCount: cp.reviewCount,
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
            price: d.price,
            category: d.category,
            prepTime: d.prepTime,
            isPopular: d.isPopular,
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
      rating: cp.rating,
      reviewCount: cp.reviewCount,
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
        price: d.price,
        category: d.category,
        prepTime: d.prepTime,
        isPopular: d.isPopular,
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
