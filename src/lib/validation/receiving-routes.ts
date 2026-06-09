import { z } from "zod";

export const receivingRouteIdSchema = z.string().uuid();
export const receivingRouteParamsSchema = z.object({
  id: receivingRouteIdSchema,
});

export const receivingRouteTypeSchema = z.enum(["exact", "alias", "catch_all"]);

const localPartSchema = z
  .string()
  .trim()
  .min(1, "Local part is required")
  .max(320, "Local part must be 320 characters or less")
  .refine((value) => !value.includes("@"), "Local part must not include @")
  .refine(
    (value) => !/[\s,<>]/.test(value),
    "Local part must not include spaces, commas, or angle brackets",
  );

export const createReceivingRouteSchema = z.object({
  domain_id: z.string().uuid(),
  type: receivingRouteTypeSchema,
  local_part: localPartSchema.nullable().optional(),
  target_local_part: localPartSchema.nullable().optional(),
});

export const updateReceivingRouteSchema = z
  .object({
    local_part: localPartSchema.nullable().optional(),
    target_local_part: localPartSchema.nullable().optional(),
  })
  .refine(
    (data) =>
      data.local_part !== undefined || data.target_local_part !== undefined,
    { message: "At least one updatable field is required" },
  );
