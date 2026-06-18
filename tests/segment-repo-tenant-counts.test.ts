import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "packages/core/src/db/repositories/segmentRepo.ts",
  "utf8",
);

describe("segmentRepo listForApi tenant-scoped aggregates", () => {
  it("counts only joined contacts that belong to the requested user", () => {
    const contactsCountQuery = source.match(
      /contactsCount:[\s\S]*?`([\s\S]*?)`\.mapWith\(Number\)/,
    )?.[1];
    const unsubscribedCountQuery = source.match(
      /unsubscribedCount:[\s\S]*?`([\s\S]*?)`\.mapWith\(Number\)/,
    )?.[1];

    expect(contactsCountQuery).toContain("inner join ${contacts}");
    expect(contactsCountQuery).toContain(
      "and ${contacts.userId} = ${options.userId}",
    );
    expect(unsubscribedCountQuery).toContain(
      "and ${contacts.userId} = ${options.userId}",
    );
    expect(unsubscribedCountQuery).toContain(
      "and ${contacts.unsubscribed} = true",
    );
  });
});
