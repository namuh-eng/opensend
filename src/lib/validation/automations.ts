import { z } from "zod";

export const automationStatusSchema = z.enum(["draft", "enabled", "disabled"]);

export const automationStepTypeSchema = z.enum([
  "trigger",
  "delay",
  "send_email",
  "end",
  "condition",
  "wait_for_event",
]);

const conditionComparableValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const conditionPredicateSchema = z
  .object({
    left: z
      .string()
      .trim()
      .regex(
        /^(event|contact)\.[A-Za-z0-9_.-]+$|^steps\.[A-Za-z0-9_:-]+\.output(\.[A-Za-z0-9_.-]+)?$/,
        "left must reference event.*, contact.*, or steps.<key>.output.*",
      ),
    operator: z.enum([
      "equals",
      "not_equals",
      "greater_than",
      "greater_than_or_equal",
      "less_than",
      "less_than_or_equal",
      "contains",
      "exists",
    ]),
    right: conditionComparableValueSchema.optional(),
  })
  .superRefine((predicate, ctx) => {
    if (predicate.operator !== "exists" && !("right" in predicate)) {
      ctx.addIssue({
        code: "custom",
        path: ["right"],
        message: "right is required unless the condition operator is exists",
      });
    }
  });

// First condition slice intentionally supports one predicate only. Compose
// branching with multiple condition steps instead of accepting expression trees.
const conditionStepConfigSchema = z.object({
  predicate: conditionPredicateSchema,
});

const waitForEventStepConfigSchema = z.object({
  event_name: z
    .string()
    .trim()
    .min(1, "event_name is required")
    .max(255, "event_name must be at most 255 characters"),
  timeout_seconds: z
    .number()
    .int("timeout_seconds must be an integer")
    .min(1, "timeout_seconds must be at least 1")
    .max(30 * 24 * 60 * 60, "timeout_seconds must be at most 30 days")
    .optional(),
});

const automationStepConfigSchema = z.record(z.string(), z.unknown());

export const automationStepSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(
        /^[A-Za-z0-9_:-]+$/,
        "step key may only contain A-Z, 0-9, _, :, -",
      ),
    type: automationStepTypeSchema,
    config: automationStepConfigSchema.optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .superRefine((step, ctx) => {
    if (step.type === "condition") {
      const parsed = conditionStepConfigSchema.safeParse(step.config);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ["config", ...issue.path],
          });
        }
      }
    }

    if (step.type === "wait_for_event") {
      const parsed = waitForEventStepConfigSchema.safeParse(step.config);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ["config", ...issue.path],
          });
        }
      }
    }
  });

export const automationConnectionSchema = z.object({
  from: z.string().min(1).max(64),
  to: z.string().min(1).max(64),
  type: z.enum(["default", "condition_met", "condition_not_met"]).optional(),
});

export const createAutomationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: automationStatusSchema.optional(),
  trigger_event_name: z.string().min(1).max(255).optional(),
  triggerEventName: z.string().min(1).max(255).optional(),
  steps: z.array(automationStepSchema).min(1),
  connections: z.array(automationConnectionSchema).optional(),
});

export const updateAutomationSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    status: automationStatusSchema.optional(),
    trigger_event_name: z.string().min(1).max(255).optional(),
    triggerEventName: z.string().min(1).max(255).optional(),
    steps: z.array(automationStepSchema).min(1).optional(),
    connections: z.array(automationConnectionSchema).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "at least one updatable field is required",
  });

export const listAutomationsQuerySchema = z.object({
  status: automationStatusSchema.optional(),
  search: z.string().trim().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  after: z.string().min(1).optional(),
});

export const listRunsQuerySchema = z.object({
  status: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  after: z.string().min(1).optional(),
});

export type CreateAutomationRequest = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationRequest = z.infer<typeof updateAutomationSchema>;
