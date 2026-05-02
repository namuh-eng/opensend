import { z } from "zod";

const eventNameSchema = z.string().min(1).max(255);
const uuidSchema = z.string().uuid();
const emailSchema = z.string().email().min(3).max(512);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const createCustomEventSchema = z.object({
  name: eventNameSchema,
  schema: jsonObjectSchema.optional(),
});

export const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  after: z.string().min(1).optional(),
});

export const sendEventSchema = z
  .object({
    event: eventNameSchema,
    contact_id: uuidSchema.optional(),
    contactId: uuidSchema.optional(),
    email: emailSchema.optional(),
    payload: jsonObjectSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.contact_id !== undefined &&
      data.contactId !== undefined &&
      data.contact_id !== data.contactId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contactId"],
        message: "contactId and contact_id must match when both are provided",
      });
      return;
    }

    const hasContactId =
      data.contact_id !== undefined || data.contactId !== undefined;
    const hasEmail = data.email !== undefined;

    if (hasContactId === hasEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasEmail ? ["email"] : ["contact_id"],
        message:
          "provide exactly one contact identifier: contact_id/contactId or email",
      });
    }
  });

export type CreateCustomEventRequest = z.infer<typeof createCustomEventSchema>;
export type SendEventRequest = z.infer<typeof sendEventSchema>;
