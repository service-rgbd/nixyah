import { z } from "zod";

export const nonEmptyTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength);

export const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .optional();

export const nullableTrimmedString = (maxLength: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value: string | null | undefined) => {
      if (typeof value !== "string") {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine((value: string | null) => value === null || value.length <= maxLength, {
      message: `La valeur ne doit pas depasser ${maxLength} caracteres`,
    });

export const positiveInt = z.number().int().positive();

export const idParamSchema = z.coerce.number().int().positive();

export const safeUrlString = z.string().trim().url().max(2048);

export const hexColorString = z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Couleur invalide");

export function formatValidationError(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  return firstIssue?.message ?? "Requete invalide";
}

export function parseWithSchema<TSchema extends z.ZodTypeAny>(schema: TSchema, input: unknown):
  | { success: true; data: z.infer<TSchema> }
  | { success: false; message: string } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: formatValidationError(parsed.error),
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}