import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("contact UUID lookup guards", () => {
  it("recognizes standard UUIDs before falling back to email lookup", () => {
    const permissiveStandardUuidPattern =
      "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    const rfcVersionedUuidPattern =
      "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

    for (const file of [
      "packages/core/src/db/repositories/contactRepo.ts",
      "packages/core/src/services/contact-operations.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(
        source.includes(permissiveStandardUuidPattern) ||
          source.includes(rfcVersionedUuidPattern),
      ).toBe(true);
      expect(source).not.toContain(
        "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
      );
    }
  });
});
