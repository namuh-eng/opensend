import { z } from "zod";

export const forwardingRuleIdSchema = z.string().uuid();
export const forwardingRuleParamsSchema = z.object({
  id: forwardingRuleIdSchema,
});

export const forwardingRuleStatusSchema = z.enum(["active", "disabled"]);

const destinationSchema = z.string().trim().email().min(3).max(512);

export const createForwardingRuleSchema = z.object({
  route_id: z.string().uuid(),
  destinations: z.array(destinationSchema).min(1).max(25),
  status: forwardingRuleStatusSchema.optional(),
});

export const updateForwardingRuleSchema = z
  .object({
    destinations: z.array(destinationSchema).min(1).max(25).optional(),
    status: forwardingRuleStatusSchema.optional(),
  })
  .refine(
    (data) => data.destinations !== undefined || data.status !== undefined,
    {
      message: "At least one updatable field is required",
    },
  );
