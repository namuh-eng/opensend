import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "packages/core/src/db/repositories/segmentRepo.ts",
  "utf8",
);

describe("segmentRepo listForApi tenant-scoped aggregates", () => {
  it("counts joined and persisted JSONB segment memberships for only the requested user", () => {
    const contactsCountQuery = source.match(
      /contactsCount:[\s\S]*?`([\s\S]*?)`\.mapWith\(Number\)/,
    )?.[1];
    const unsubscribedCountQuery = source.match(
      /unsubscribedCount:[\s\S]*?`([\s\S]*?)`\.mapWith\(Number\)/,
    )?.[1];

    expect(contactsCountQuery).toContain("count(distinct ${contacts.id})");
    expect(contactsCountQuery).toContain("left join ${contactsToSegments}");
    expect(contactsCountQuery).toContain(
      "where ${contacts.userId} = ${options.userId}",
    );
    expect(contactsCountQuery).toContain(
      "coalesce(${contacts.segments}, '[]'::jsonb) ? ${segments.name}",
    );
    expect(unsubscribedCountQuery).toContain("count(distinct ${contacts.id})");
    expect(unsubscribedCountQuery).toContain(
      "where ${contacts.userId} = ${options.userId}",
    );
    expect(unsubscribedCountQuery).toContain(
      "and ${contacts.unsubscribed} = true",
    );
    expect(unsubscribedCountQuery).toContain(
      "coalesce(${contacts.segments}, '[]'::jsonb) ? ${segments.name}",
    );
  });
});
