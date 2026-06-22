import { normalizeProperty } from "@/components/properties-list";
import { describe, expect, it } from "vitest";

describe("properties list normalization", () => {
  it("preserves all supported dashboard property types", () => {
    expect(
      normalizeProperty({ id: "p1", name: "Plan", type: "string" }).type,
    ).toBe("string");
    expect(
      normalizeProperty({ id: "p2", name: "Score", type: "number" }).type,
    ).toBe("number");
    expect(
      normalizeProperty({ id: "p3", name: "Subscribed", type: "boolean" }).type,
    ).toBe("boolean");
    expect(
      normalizeProperty({ id: "p4", name: "Renewal", type: "date" }).type,
    ).toBe("date");
  });
});
