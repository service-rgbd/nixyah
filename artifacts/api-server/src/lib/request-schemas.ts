import { z } from "zod";
import { hexColorString, idParamSchema, nonEmptyTrimmedString, nullableTrimmedString, safeUrlString } from "./validation.js";

export const latitudeSchema = z.coerce.number().finite().min(-90).max(90);
export const longitudeSchema = z.coerce.number().finite().min(-180).max(180);
export const positiveQuantitySchema = z.coerce.number().int().min(1).max(100);
export const optionalAddressSchema = nullableTrimmedString(255);
export const optionalNotesSchema = nullableTrimmedString(1000);

export const deliveryAvailabilityBodySchema = z.object({
  isAvailable: z.boolean(),
});

export const courierLocationBodySchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const deliveryJobLocationBodySchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  accuracy: z.coerce.number().finite().min(0).max(10000).nullable().optional(),
  heading: z.coerce.number().finite().min(0).max(360).nullable().optional(),
  speed: z.coerce.number().finite().min(0).max(300).nullable().optional(),
});

export const clientDeliveryLocationBodySchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  deliveryAddress: optionalAddressSchema.optional(),
});

export const cartAddItemBodySchema = z.object({
  dishId: idParamSchema,
  quantity: positiveQuantitySchema.default(1),
});

export const cartUpdateItemBodySchema = z.object({
  quantity: positiveQuantitySchema,
});

export const deliveryQuoteBodySchema = z.object({
  deliveryAddress: optionalAddressSchema.optional(),
  deliveryLatitude: latitudeSchema.nullable().optional(),
  deliveryLongitude: longitudeSchema.nullable().optional(),
});

export const checkoutBodySchema = z.object({
  deliveryAddress: optionalAddressSchema.optional(),
  notes: optionalNotesSchema.optional(),
  deliveryLatitude: latitudeSchema.nullable().optional(),
  deliveryLongitude: longitudeSchema.nullable().optional(),
});

export const commerceAddItemBodySchema = z.object({
  productId: idParamSchema,
  quantity: positiveQuantitySchema.default(1),
});

export const commerceUpdateItemBodySchema = z.object({
  quantity: positiveQuantitySchema,
});

export const customRequestCreateBodySchema = z.object({
  chefId: idParamSchema,
  packageDishId: idParamSchema,
  estimatedPersons: z.coerce.number().int().min(1).max(500).default(1),
  estimatedTotal: z.coerce.number().finite().min(0).max(100000000).optional(),
  preferences: z.array(nonEmptyTrimmedString(80)).max(20).optional().default([]),
  occasion: nullableTrimmedString(120).optional(),
  budget: nullableTrimmedString(120).optional(),
  storyReference: nullableTrimmedString(255).optional(),
  deliveryAddress: optionalAddressSchema.optional(),
  notes: optionalNotesSchema.optional(),
});

export const customRequestStatusSchema = z.object({
  status: z.enum(["quoted", "accepted", "rejected", "cancelled"]),
  chefResponse: nullableTrimmedString(1000).optional(),
});

export const adminCommerceStoreStatusSchema = z.object({
  status: z.enum(["draft", "pending_review", "approved", "suspended", "rejected"]),
  isActive: z.boolean().optional(),
});

export const adminChefStatusSchema = z.object({
  status: z.enum(["active", "suspended", "pending_verification", "rejected"]),
});

export const adminChefVerifySchema = z.object({
  isVerified: z.boolean(),
});

const merchantUniverseSchema = z.enum(["courses", "supermarkets", "boutiques"]);

export const merchantCreateStoreSchema = z.object({
  universe: merchantUniverseSchema,
  name: nonEmptyTrimmedString(120),
  location: nonEmptyTrimmedString(255),
  tagline: nullableTrimmedString(160).optional(),
  description: nullableTrimmedString(2000).optional(),
  zone: nullableTrimmedString(120).optional(),
  accentColor: hexColorString.optional(),
  visualKey: nullableTrimmedString(80).optional(),
  logoUrl: safeUrlString.nullable().optional(),
  bannerUrl: safeUrlString.nullable().optional(),
  etaMinMinutes: z.coerce.number().int().min(1).max(600).optional(),
  etaMaxMinutes: z.coerce.number().int().min(1).max(600).optional(),
}).superRefine((value, ctx) => {
  if (
    typeof value.etaMinMinutes === "number" &&
    typeof value.etaMaxMinutes === "number" &&
    value.etaMinMinutes > value.etaMaxMinutes
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le delai minimum ne peut pas depasser le delai maximum" });
  }
});

export const merchantUpdateStoreSchema = z.object({
  name: nullableTrimmedString(120).optional(),
  tagline: nullableTrimmedString(160).optional(),
  description: nullableTrimmedString(2000).optional(),
  location: nullableTrimmedString(255).optional(),
  zone: nullableTrimmedString(120).optional(),
  accentColor: hexColorString.optional(),
  visualKey: nullableTrimmedString(80).optional(),
  logoUrl: safeUrlString.nullable().optional(),
  bannerUrl: safeUrlString.nullable().optional(),
  etaMinMinutes: z.coerce.number().int().min(1).max(600).optional(),
  etaMaxMinutes: z.coerce.number().int().min(1).max(600).optional(),
}).superRefine((value, ctx) => {
  if (
    typeof value.etaMinMinutes === "number" &&
    typeof value.etaMaxMinutes === "number" &&
    value.etaMinMinutes > value.etaMaxMinutes
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le delai minimum ne peut pas depasser le delai maximum" });
  }
});

export const merchantCreateProductSchema = z.object({
  name: nonEmptyTrimmedString(120),
  description: nullableTrimmedString(2000).optional(),
  category: nullableTrimmedString(80).optional(),
  price: z.coerce.number().finite().min(0).max(100000000),
  originalPrice: z.coerce.number().finite().min(0).max(100000000).nullable().optional(),
  badge: nullableTrimmedString(80).optional(),
  unitLabel: nullableTrimmedString(40).optional(),
  visualKey: nullableTrimmedString(80).optional(),
  inStock: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (typeof value.originalPrice === "number" && value.originalPrice < value.price) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le prix original doit etre superieur ou egal au prix courant" });
  }
});

export const merchantUpdateProductSchema = z.object({
  name: nullableTrimmedString(120).optional(),
  description: nullableTrimmedString(2000).optional(),
  category: nullableTrimmedString(80).optional(),
  price: z.coerce.number().finite().min(0).max(100000000).optional(),
  originalPrice: z.coerce.number().finite().min(0).max(100000000).nullable().optional(),
  badge: nullableTrimmedString(80).optional(),
  unitLabel: nullableTrimmedString(40).optional(),
  visualKey: nullableTrimmedString(80).optional(),
  inStock: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (
    typeof value.price === "number" &&
    typeof value.originalPrice === "number" &&
    value.originalPrice < value.price
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le prix original doit etre superieur ou egal au prix courant" });
  }
});

export type DeliveryAvailabilityBody = z.infer<typeof deliveryAvailabilityBodySchema>;
export type CourierLocationBody = z.infer<typeof courierLocationBodySchema>;
export type DeliveryJobLocationBody = z.infer<typeof deliveryJobLocationBodySchema>;
export type ClientDeliveryLocationBody = z.infer<typeof clientDeliveryLocationBodySchema>;
export type CartAddItemBody = z.infer<typeof cartAddItemBodySchema>;
export type CartUpdateItemBody = z.infer<typeof cartUpdateItemBodySchema>;
export type DeliveryQuoteBody = z.infer<typeof deliveryQuoteBodySchema>;
export type CheckoutBody = z.infer<typeof checkoutBodySchema>;
export type CommerceAddItemBody = z.infer<typeof commerceAddItemBodySchema>;
export type CommerceUpdateItemBody = z.infer<typeof commerceUpdateItemBodySchema>;
export type CustomRequestCreateBody = z.infer<typeof customRequestCreateBodySchema>;
export type CustomRequestStatusBody = z.infer<typeof customRequestStatusSchema>;
export type AdminCommerceStoreStatusBody = z.infer<typeof adminCommerceStoreStatusSchema>;
export type AdminChefStatusBody = z.infer<typeof adminChefStatusSchema>;
export type AdminChefVerifyBody = z.infer<typeof adminChefVerifySchema>;
export type MerchantCreateStoreBody = z.infer<typeof merchantCreateStoreSchema>;
export type MerchantUpdateStoreBody = z.infer<typeof merchantUpdateStoreSchema>;
export type MerchantCreateProductBody = z.infer<typeof merchantCreateProductSchema>;
export type MerchantUpdateProductBody = z.infer<typeof merchantUpdateProductSchema>;