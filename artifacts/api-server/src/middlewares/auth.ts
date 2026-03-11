import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth.js";

export interface AuthRequest extends Request {
  userId?: number;
  userType?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Token manquant" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized", message: "Token invalide ou expiré" });
    return;
  }
  req.userId = payload.userId;
  req.userType = payload.type;
  next();
}

export function requireChef(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.userType !== "chef") {
      res.status(403).json({ error: "Forbidden", message: "Réservé aux cuisinières" });
      return;
    }
    next();
  });
}
