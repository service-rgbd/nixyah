import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { chefProfilesTable, courierProfilesTable, merchantProfilesTable, usersTable, type User } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "../lib/auth.js";

export interface AuthRequest extends Request {
  userId?: number;
  userType?: User["type"];
  user?: User;
  chefProfileId?: number;
  courierProfileId?: number;
  merchantProfileId?: number;
}

async function authenticateRequest(req: AuthRequest, res: Response): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Token manquant" });
    return false;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized", message: "Token invalide ou expiré" });
    return false;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "Utilisateur introuvable" });
    return false;
  }

  if (user.email && user.emailConfirmed === false) {
    res.status(403).json({
      error: "EmailUnconfirmed",
      message: "Veuillez confirmer votre adresse email avant d'accéder à cette ressource",
    });
    return false;
  }

  req.userId = user.id;
  req.userType = user.type;
  req.user = user;

  if (user.type === "chef") {
    const [chefProfile] = await db
      .select()
      .from(chefProfilesTable)
      .where(eq(chefProfilesTable.userId, user.id))
      .limit(1);

    if (chefProfile) {
      req.chefProfileId = chefProfile.id;
    }
  }

  if (user.type === "courier") {
    const [courierProfile] = await db
      .select()
      .from(courierProfilesTable)
      .where(eq(courierProfilesTable.userId, user.id))
      .limit(1);

    if (courierProfile) {
      req.courierProfileId = courierProfile.id;
    }
  }

  if (user.type === "merchant") {
    const [merchantProfile] = await db
      .select()
      .from(merchantProfilesTable)
      .where(eq(merchantProfilesTable.userId, user.id))
      .limit(1);

    if (merchantProfile) {
      req.merchantProfileId = merchantProfile.id;
    }
  }

  return true;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const isAuthenticated = await authenticateRequest(req, res);
  if (!isAuthenticated) {
    return;
  }
  next();
}

export async function requireChef(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const isAuthenticated = await authenticateRequest(req, res);
  if (!isAuthenticated) {
    return;
  }
  if (req.userType !== "chef" || !req.chefProfileId) {
    res.status(403).json({ error: "Forbidden", message: "Réservé aux cuisinières" });
    return;
  }
  next();
}

export async function requireOperationalChef(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const isAuthenticated = await authenticateRequest(req, res);
  if (!isAuthenticated) {
    return;
  }
  if (req.userType !== "chef" || !req.chefProfileId) {
    res.status(403).json({ error: "Forbidden", message: "Réservé aux cuisinières" });
    return;
  }

  const [chefProfile] = await db
    .select()
    .from(chefProfilesTable)
    .where(eq(chefProfilesTable.id, req.chefProfileId))
    .limit(1);

  if (!chefProfile?.isVerified || !chefProfile.isOnline) {
    res.status(403).json({
      error: "ChefInactive",
      message: "Votre espace cuisinière doit être vérifié et actif pour effectuer cette action",
    });
    return;
  }

  next();
}

export async function requireClient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const isAuthenticated = await authenticateRequest(req, res);
  if (!isAuthenticated) {
    return;
  }
  if (req.userType !== "client") {
    res.status(403).json({ error: "Forbidden", message: "Réservé aux clientes" });
    return;
  }
  next();
}

export async function requireCourier(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const isAuthenticated = await authenticateRequest(req, res);
  if (!isAuthenticated) {
    return;
  }
  if (req.userType !== "courier" || !req.courierProfileId) {
    res.status(403).json({ error: "Forbidden", message: "Réservé aux livreurs" });
    return;
  }
  next();
}

export async function requireVerifiedCourier(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const isAuthenticated = await authenticateRequest(req, res);
  if (!isAuthenticated) {
    return;
  }
  if (req.userType !== "courier" || !req.courierProfileId) {
    res.status(403).json({ error: "Forbidden", message: "Réservé aux livreurs" });
    return;
  }

  const [courierProfile] = await db
    .select()
    .from(courierProfilesTable)
    .where(eq(courierProfilesTable.id, req.courierProfileId))
    .limit(1);

  if (!courierProfile?.isVerified) {
    res.status(403).json({
      error: "CourierUnverified",
      message: "Votre compte livreur doit être vérifié pour effectuer cette action",
    });
    return;
  }

  next();
}

export async function requireMerchant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const isAuthenticated = await authenticateRequest(req, res);
  if (!isAuthenticated) {
    return;
  }
  if (req.userType !== "merchant" || !req.merchantProfileId) {
    res.status(403).json({ error: "Forbidden", message: "Réservé aux marchands" });
    return;
  }
  next();
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const isAuthenticated = await authenticateRequest(req, res);
  if (!isAuthenticated) {
    return;
  }
  if (req.userType !== "admin") {
    res.status(403).json({ error: "Forbidden", message: "Réservé aux administrateurs" });
    return;
  }
  next();
}
