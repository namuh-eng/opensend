import { createDomainSchema } from "@/lib/validation/domains";
import { describe, expect, it } from "vitest";

const basePayload = {
  name: "example.com",
};

describe("domain validation", () => {
  it("accepts an omitted custom return path so callers get the default send label", () => {
    const result = createDomainSchema.safeParse(basePayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.custom_return_path).toBeUndefined();
    }
  });

  it("accepts a valid custom return path label", () => {
    const result = createDomainSchema.safeParse({
      ...basePayload,
      custom_return_path: "outbound-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.custom_return_path).toBe("outbound-1");
    }
  });

  it.each([
    ["too long", "a".repeat(64)],
    ["does not start with a letter", "1outbound"],
    ["does not end with a letter or number", "outbound-"],
    ["contains a dot", "outbound.example"],
    ["contains an underscore", "out_bound"],
  ])("rejects a custom return path label that %s", (_reason, label) => {
    const result = createDomainSchema.safeParse({
      ...basePayload,
      custom_return_path: label,
    });

    expect(result.success).toBe(false);
  });
});
