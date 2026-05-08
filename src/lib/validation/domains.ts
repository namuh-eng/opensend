import { z } from "zod";

export const validDomainRegions = [
  "us-east-1",
  "eu-west-1",
  "sa-east-1",
  "ap-northeast-1",
] as const;

export const domainIdSchema = z.string().uuid();

export const domainRouteParamsSchema = z.object({
  id: domainIdSchema,
});

export const domainRegionSchema = z.enum(validDomainRegions);

export const domainTlsSchema = z.enum(["opportunistic", "enforced"]);

export const domainCapabilitySchema = z.object({
  name: z.string().min(1).max(255),
  enabled: z.boolean(),
});

export const returnPathLabelSchema = z
  .string()
  .trim()
  .min(1, "Return path is required")
  .max(63, "Return path must be 63 characters or less")
  .regex(/^[A-Za-z]/, "Return path must start with a letter")
  .regex(/[A-Za-z0-9]$/, "Return path must end with a letter or number")
  .regex(
    /^[A-Za-z0-9-]+$/,
    "Return path can only contain letters, numbers, and hyphens",
  );

export const createDomainSchema = z.object({
  name: z.string().trim().min(1, "Domain name is required").max(255),
  region: domainRegionSchema.optional().default("us-east-1"),
  custom_return_path: returnPathLabelSchema.optional(),
  open_tracking: z.boolean().optional(),
  click_tracking: z.boolean().optional(),
  tracking_subdomain: z.string().trim().min(1).max(255).optional(),
  tls: domainTlsSchema.optional().default("opportunistic"),
  capabilities: z.array(domainCapabilitySchema).optional(),
});

export const updateDomainSchema = z
  .object({
    click_tracking: z.boolean().optional(),
    open_tracking: z.boolean().optional(),
    tracking_subdomain: z.string().trim().min(1).max(255).optional(),
    capabilities: z.array(domainCapabilitySchema).optional(),
    sending_enabled: z.boolean().optional(),
    receiving_enabled: z.boolean().optional(),
    tls: domainTlsSchema.optional(),
  })
  .refine(
    (data) =>
      data.click_tracking !== undefined ||
      data.open_tracking !== undefined ||
      data.tracking_subdomain !== undefined ||
      data.capabilities !== undefined ||
      data.sending_enabled !== undefined ||
      data.receiving_enabled !== undefined ||
      data.tls !== undefined,
    {
      message: "At least one updatable field is required",
    },
  );

export const verifyDomainParamsSchema = domainRouteParamsSchema;

export type DomainRouteParams = z.infer<typeof domainRouteParamsSchema>;
export type CreateDomainRequest = z.infer<typeof createDomainSchema>;
export type UpdateDomainRequest = z.infer<typeof updateDomainSchema>;
