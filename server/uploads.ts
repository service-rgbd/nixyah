import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "./env";
import { randomUUID } from "crypto";

function getR2Client() {
  const env = getEnv();
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET
  ) {
    throw new Error("R2 env vars missing");
  }
  const endpoint =
    env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  return { env, client };
}

export async function createPresignedUpload(params: {
  contentType: string;
  ext: string;
  kind: "photo" | "video";
}) {
  const { env, client } = getR2Client();

  const key = `${params.kind}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${
    params.ext
  }`;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 10 }); // 10 min

  const publicBase = env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  const publicUrl = publicBase ? `${publicBase}/${key}` : null;

  // Signed GET fallback (useful when bucket is private or r2.dev returns 404)
  const viewUrl = await createPresignedRead(key, 60 * 60 * 24 * 7);

  return { key, uploadUrl, publicUrl, viewUrl };
}

export async function createPresignedRead(key: string, expiresInSeconds = 3600) {
  const { env, client } = getR2Client();
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET!,
    Key: key,
  });
  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function uploadBufferToR2(params: {
  buffer: Buffer;
  contentType: string;
  filename: string;
  kind: "photo" | "video";
}) {
  const { env, client } = getR2Client();
  const ext = params.filename.split(".").pop()?.toLowerCase() || "bin";
  const key = `${params.kind}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET!,
    Key: key,
    ContentType: params.contentType,
    Body: params.buffer,
  });
  await client.send(command);

  const publicBase = env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  const publicUrl = publicBase ? `${publicBase}/${key}` : null;
  const viewUrl = await createPresignedRead(key, 60 * 60 * 24 * 7);

  return { key, publicUrl, viewUrl };
}


