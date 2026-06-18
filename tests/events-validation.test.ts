import {
  createCustomEventSchema,
  updateCustomEventSchema,
} from "@/lib/validation/events";
import { describe, expect, it } from "vitest";

describe("event route validation", () => {
  it("reserves the send identifier for event delivery routes", () => {
    expect(createCustomEventSchema.safeParse({ name: "send" }).success).toBe(
      false,
    );
    expect(updateCustomEventSchema.safeParse({ name: "SEND" }).success).toBe(
      false,
    );
  });
});
