import { z } from "zod";

export const automationStatusSchema = z.enum(["draft", "enabled", "disabled"]);

export const automationStepTypeSchema = z.enum([
  "trigger",
  "delay",
  "send_email",
  "end",
]);

const automationStepConfigSchema = z.record(z.string(), z.unknown());

export const automationStepSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_:-]+$/, "step key may only contain A-Z, 0-9, _, :, -"),
  type: automationStepTypeSchema,
  config: automationStepConfigSchema.optional(),
  position: z.number().int().nonnegative().optional(),
});

export const automationConnectionSchema = z.object({
  from: z.string().min(1).max(64),
  to: z.string().min(1).max(64),
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
