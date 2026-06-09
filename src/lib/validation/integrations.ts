import { z } from "zod";

export const integrationConnectionIdSchema = z.string().uuid();

export const connectWebhookIntegrationSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  webhook_url: z.string().trim().url().max(2048),
  signing_secret: z.string().trim().max(512).nullable().optional(),
});

export const updateWebhookIntegrationSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    webhook_url: z.string().trim().url().max(2048).optional(),
    signing_secret: z.string().trim().max(512).nullable().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.webhook_url !== undefined ||
      data.signing_secret !== undefined,
    { message: "At least one field is required" },
  );

export type ConnectWebhookIntegrationRequest = z.infer<
  typeof connectWebhookIntegrationSchema
>;
export type UpdateWebhookIntegrationRequest = z.infer<
  typeof updateWebhookIntegrationSchema
>;
