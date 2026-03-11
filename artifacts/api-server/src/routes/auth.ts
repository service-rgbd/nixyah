import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, chefProfilesTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken } from "../lib/auth.js";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.post("/auth/register/client", async (req, res) => {
  try {
    const { name, email, phone, password, location, preferences } = req.body;

    if (!name || !password) {
      res.status(400).json({ error: "BadRequest", message: "Nom et mot de passe requis" });
      return;
    }
    if (!email && !phone) {
      res.status(400).json({ error: "BadRequest", message: "Email ou téléphone requis" });
      return;
    }

    const existing = await db.select().from(usersTable).where(
      or(
        email ? eq(usersTable.email, email) : undefined,
        phone ? eq(usersTable.phone, phone) : undefined,
      )
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "Email ou téléphone déjà utilisé" });
      return;
    }

    const COLORS = ["#C4522A", "#8B5CF6", "#059669", "#D97706", "#DC2626", "#BE185D"];
    const coverColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    const [user] = await db.insert(usersTable).values({
      name,
      email: email || null,
      phone: phone || null,
      passwordHash: hashPassword(password),
      type: "client",
      location: location || "Abidjan",
      coverColor,
      preferences: preferences || [],
    }).returning();

    const token = signToken({ userId: user.id, type: "client" });
    res.status(201).json({
      token,
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        type: user.type,
        location: user.location,
        coverColor: user.coverColor,
      },
    });
  } catch (err) {
    console.error("register client error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/auth/register/chef", async (req, res) => {
  try {
    const { name, email, phone, password, specialty, location, zone, bio, priceRange, coverColor, specialties } = req.body;

    if (!name || !password || !specialty || !location || !zone || !bio || !priceRange) {
      res.status(400).json({ error: "BadRequest", message: "Champs requis manquants" });
      return;
    }
    if (!email && !phone) {
      res.status(400).json({ error: "BadRequest", message: "Email ou téléphone requis" });
      return;
    }

    const existing = await db.select().from(usersTable).where(
      or(
        email ? eq(usersTable.email, email) : undefined,
        phone ? eq(usersTable.phone, phone) : undefined,
      )
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "Email ou téléphone déjà utilisé" });
      return;
    }

    const COLORS = ["#C4522A", "#8B5CF6", "#059669", "#D97706", "#DC2626", "#BE185D"];
    const chefColor = coverColor || COLORS[Math.floor(Math.random() * COLORS.length)];

    const [user] = await db.insert(usersTable).values({
      name,
      email: email || null,
      phone: phone || null,
      passwordHash: hashPassword(password),
      type: "chef",
      location,
      coverColor: chefColor,
    }).returning();

    const [profile] = await db.insert(chefProfilesTable).values({
      userId: user.id,
      specialty,
      location,
      zone,
      bio,
      priceRange,
      specialties: specialties || [],
      isOnline: true,
      rating: 5.0,
      reviewCount: 0,
    }).returning();

    const token = signToken({ userId: user.id, type: "chef" });
    res.status(201).json({
      token,
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        type: user.type,
        location: user.location,
        coverColor: user.coverColor,
        chefProfile: {
          id: String(profile.id),
          userId: String(profile.userId),
          name: user.name,
          specialty: profile.specialty,
          location: profile.location,
          zone: profile.zone,
          bio: profile.bio,
          rating: profile.rating,
          reviewCount: profile.reviewCount,
          priceRange: profile.priceRange,
          isVerified: profile.isVerified,
          isOnline: profile.isOnline,
          coverColor: chefColor,
          responseTime: profile.responseTime,
        },
      },
    });
  } catch (err) {
    console.error("register chef error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      res.status(400).json({ error: "BadRequest", message: "Identifiants requis" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(
      or(eq(usersTable.email, emailOrPhone), eq(usersTable.phone, emailOrPhone))
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Identifiants incorrects" });
      return;
    }

    let chefProfile = null;
    if (user.type === "chef") {
      const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.userId, user.id));
      if (cp) {
        chefProfile = {
          id: String(cp.id),
          userId: String(cp.userId),
          name: user.name,
          specialty: cp.specialty,
          location: cp.location,
          zone: cp.zone,
          bio: cp.bio,
          rating: cp.rating,
          reviewCount: cp.reviewCount,
          priceRange: cp.priceRange,
          isVerified: cp.isVerified,
          isOnline: cp.isOnline,
          coverColor: user.coverColor,
          responseTime: cp.responseTime,
        };
      }
    }

    const token = signToken({ userId: user.id, type: user.type });
    res.json({
      token,
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        type: user.type,
        location: user.location,
        coverColor: user.coverColor,
        chefProfile,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Utilisateur introuvable" });
      return;
    }

    let chefProfile = null;
    if (user.type === "chef") {
      const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.userId, user.id));
      if (cp) {
        chefProfile = {
          id: String(cp.id),
          userId: String(cp.userId),
          name: user.name,
          specialty: cp.specialty,
          location: cp.location,
          zone: cp.zone,
          bio: cp.bio,
          rating: cp.rating,
          reviewCount: cp.reviewCount,
          priceRange: cp.priceRange,
          isVerified: cp.isVerified,
          isOnline: cp.isOnline,
          coverColor: user.coverColor,
          responseTime: cp.responseTime,
        };
      }
    }

    res.json({
      id: String(user.id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      type: user.type,
      location: user.location,
      coverColor: user.coverColor,
      chefProfile,
    });
  } catch (err) {
    console.error("me error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;
