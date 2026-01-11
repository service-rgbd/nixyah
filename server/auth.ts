import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const PBKDF2_ITERATIONS = 210_000;
const KEYLEN = 32;
const DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEYLEN, DIGEST).toString(
    "hex",
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [alg, iterStr, salt, hash] = stored.split("$");
    if (alg !== "pbkdf2") return false;
    const iterations = Number(iterStr);
    if (!Number.isFinite(iterations) || iterations < 1) return false;
    const derived = pbkdf2Sync(password, salt, iterations, KEYLEN, DIGEST);
    const expected = Buffer.from(hash, "hex");
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}



