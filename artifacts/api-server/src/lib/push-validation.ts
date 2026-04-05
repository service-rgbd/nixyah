import { z } from "zod";
import { nonEmptyTrimmedString, safeUrlString } from "./validation.js";

const pushPlatformSchema = z.enum(["web", "expo"]);

const subscribeBodyBaseSchema = z.object({
  endpoint: z.string().trim().max(4096).optional(),
  token: z.string().trim().max(4096).optional(),
  platform: pushPlatformSchema.optional(),
  keys: z
    .object({
      p256dh: nonEmptyTrimmedString(2048),
      auth: nonEmptyTrimmedString(1024),
    })
    .partial()
    .optional(),
});

export const subscribeBodySchema = subscribeBodyBaseSchema.superRefine((value, ctx) => {
  const platform = value.platform ?? "web";
  if (platform === "expo") {
    if (!value.token && !value.endpoint) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Token expo requis" });
    }
    return;
  }

  if (!value.endpoint) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Endpoint requis" });
    return;
  }

  if (!safeUrlString.safeParse(value.endpoint).success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Endpoint de souscription invalide" });
  }

  if (!value.keys?.p256dh || !value.keys?.auth) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cles de souscription invalides" });
  }
});

export const unsubscribeBodySchema = z.object({
  endpoint: safeUrlString,
});

export const sendPushBodySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  targets: z.array(z.coerce.number().int().positive()).max(5).optional(),
  title: nonEmptyTrimmedString(120),
  message: nonEmptyTrimmedString(280),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
export type UnsubscribeBody = z.infer<typeof unsubscribeBodySchema>;
export type SendPushBody = z.infer<typeof sendPushBodySchema>;