import express from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import {
  assertR2Config,
  buildPublicUploadUrl,
  buildUploadKey,
  getR2Config,
  validateUploadInput,
} from "../lib/uploads.js";

const router = express.Router();

function createS3Client() {
  const config = getR2Config();
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId ?? "",
      secretAccessKey: config.secretAccessKey ?? "",
    },
  });
}

// POST /api/uploads/presign
// body: { filename, contentType, purpose, fileSize }
router.post("/uploads/presign", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    assertR2Config();
    const config = getR2Config();
    const { filename, contentType, purpose, fileSize } = validateUploadInput(req.body);

    const key = buildUploadKey(userId, purpose, filename);

    const client = createS3Client();
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize,
    });
    const url = await getSignedUrl(client, command, { expiresIn: 60 * 10 });
    const publicUrl = buildPublicUploadUrl(key);

    return res.json({ url, key, publicUrl, purpose, expiresIn: 60 * 10 });
  } catch (err) {
    if (err instanceof Error) {
      const statusCode = err.message.startsWith("Missing required R2 environment variables") ? 500 : 400;
      return res.status(statusCode).json({ error: statusCode === 500 ? "ServerMisconfigured" : "BadRequest", message: err.message });
    }
    console.error("presign error", err);
    return res.status(500).json({ error: "InternalError" });
  }
});

export default router;
