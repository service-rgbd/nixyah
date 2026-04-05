import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const WEAK_JWT_SECRET_PATTERNS = ["change_me", "your_jwt_secret", "default", "secret_key_here"];

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required.");
  }
  if (secret.length < 32 || WEAK_JWT_SECRET_PATTERNS.some((pattern) => secret.toLowerCase().includes(pattern))) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be a strong, unique secret in production.");
    }
    console.warn("JWT_SECRET is weak and should be replaced before production deployment.");
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();
const JWT_ISSUER = process.env.JWT_ISSUER ?? "ivory-diaspora-api";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "ivory-diaspora-clients";

export interface TokenPayload {
  userId: number;
  type: string;
}

function isTokenPayload(value: unknown): value is TokenPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<TokenPayload>;
  return Number.isInteger(payload.userId) && payload.userId! > 0 && typeof payload.type === "string" && payload.type.length > 0;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "30d",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    subject: String(payload.userId),
    algorithm: "HS256",
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const verified = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });

    return isTokenPayload(verified) ? verified : null;
  } catch {
    try {
      const legacyVerified = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
      return isTokenPayload(legacyVerified) ? legacyVerified : null;
    } catch {
      return null;
    }
  }
}
