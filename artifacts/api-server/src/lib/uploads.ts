import crypto from "crypto";

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET;

function normalizePublicBaseUrl(rawValue: string | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue.replace(/^\/+/, "")}`;

  return withProtocol.replace(/\/$/, "");
}

const R2_PUBLIC_BASE_URL = normalizePublicBaseUrl(
  process.env.R2_PUBLIC_BASE_URL ?? process.env.R2_PUBLIC_URL,
);

export type UploadPurpose = "avatar" | "story" | "dish";

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);

const PURPOSE_CONFIG: Record<UploadPurpose, { prefix: string; maxBytes: number }> = {
  avatar: { prefix: "avatars", maxBytes: 5 * 1024 * 1024 },
  story: { prefix: "stories", maxBytes: 100 * 1024 * 1024 },
  dish: { prefix: "dishes", maxBytes: 10 * 1024 * 1024 },
};

export function getR2Config() {
  return {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    endpoint: R2_ENDPOINT,
    bucket: R2_BUCKET,
    publicBaseUrl: R2_PUBLIC_BASE_URL,
  };
}

export function assertR2Config(): void {
  const missing = [
    ["R2_ACCESS_KEY_ID", R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", R2_SECRET_ACCESS_KEY],
    ["R2_ENDPOINT", R2_ENDPOINT],
    ["R2_BUCKET", R2_BUCKET],
    ["R2_PUBLIC_BASE_URL", R2_PUBLIC_BASE_URL],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required R2 environment variables: ${missing.join(", ")}`);
  }
}

function getExtension(filename: string): string | null {
  const parts = filename.toLowerCase().split(".");
  if (parts.length < 2) {
    return null;
  }
  return parts.at(-1) ?? null;
}

export function validateUploadInput(input: {
  filename: unknown;
  contentType: unknown;
  purpose: unknown;
  fileSize: unknown;
}): { filename: string; contentType: string; purpose: UploadPurpose; fileSize: number } {
  const filename = typeof input.filename === "string" ? input.filename.trim() : "";
  const contentType = typeof input.contentType === "string" ? input.contentType.trim().toLowerCase() : "";
  const purpose = typeof input.purpose === "string" ? input.purpose.trim().toLowerCase() : "";
  const fileSize = Number(input.fileSize);

  if (!filename) {
    throw new Error("Le nom du fichier est requis.");
  }
  if (!contentType || (!IMAGE_MIME_TYPES.has(contentType) && !VIDEO_MIME_TYPES.has(contentType))) {
    throw new Error("Type de fichier non autorisé.");
  }
  if (purpose !== "avatar" && purpose !== "story" && purpose !== "dish") {
    throw new Error("Usage d'upload invalide.");
  }
  const extension = getExtension(filename);
  if (!extension || (!IMAGE_EXTENSIONS.has(extension) && !VIDEO_EXTENSIONS.has(extension))) {
    throw new Error("Extension de fichier non autorisée.");
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("La taille du fichier est invalide.");
  }
  if (fileSize > PURPOSE_CONFIG[purpose].maxBytes) {
    throw new Error("Le fichier dépasse la taille maximale autorisée.");
  }

  return { filename, contentType, purpose, fileSize };
}

export function buildUploadKey(userId: number, purpose: UploadPurpose, filename: string): string {
  const extension = getExtension(filename);
  const safeExtension = extension && (IMAGE_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension)) ? extension : "bin";
  const { prefix } = PURPOSE_CONFIG[purpose];
  return `${prefix}/${userId}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
}

export function buildPublicUploadUrl(key: string): string {
  if (!R2_PUBLIC_BASE_URL) {
    throw new Error("R2 public base URL is not configured.");
  }
  return `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}

export function extractUploadKey(publicUrl: string): string | null {
  if (typeof publicUrl !== "string" || !publicUrl.trim()) {
    return null;
  }

  const trimmedUrl = publicUrl.trim();

  if (R2_PUBLIC_BASE_URL) {
    const normalizedPublicBaseUrl = R2_PUBLIC_BASE_URL.replace(/\/$/, "");
    if (trimmedUrl.startsWith(`${normalizedPublicBaseUrl}/`)) {
      return trimmedUrl.slice(normalizedPublicBaseUrl.length + 1);
    }
  }

  if (R2_ENDPOINT && R2_BUCKET) {
    const bucketBaseUrl = `${R2_ENDPOINT.replace(/\/$/, "")}/${R2_BUCKET}`;
    if (trimmedUrl.startsWith(`${bucketBaseUrl}/`)) {
      return trimmedUrl.slice(bucketBaseUrl.length + 1);
    }
  }

  return null;
}

export function isOwnedUploadUrl(
  publicUrl: string,
  purpose: UploadPurpose,
  userId: number,
): boolean {
  const key = extractUploadKey(publicUrl);
  if (!key) {
    return false;
  }
  return key.startsWith(`${PURPOSE_CONFIG[purpose].prefix}/${userId}/`);
}
