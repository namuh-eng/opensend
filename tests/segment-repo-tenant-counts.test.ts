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

    expect(contactsCountQuery).toContain("count(distinct c.id)");
    expect(contactsCountQuery).toContain(
      "left join ${contactsToSegments} as cs",
    );
    expect(contactsCountQuery).toContain(
      'cs.segment_id = ${sql.raw(\'"segments"."id"\')}',
    );
    expect(contactsCountQuery).toContain("where c.user_id = ${options.userId}");
    expect(contactsCountQuery).toContain(
      "coalesce(c.segments, '[]'::jsonb) ? ${sql.raw('\"segments\".\"name\"')}",
    );
    expect(unsubscribedCountQuery).toContain("count(distinct c.id)");
    expect(unsubscribedCountQuery).toContain(
      "where c.user_id = ${options.userId}",
    );
    expect(unsubscribedCountQuery).toContain("and c.unsubscribed = true");
    expect(unsubscribedCountQuery).toContain(
      "coalesce(c.segments, '[]'::jsonb) ? ${sql.raw('\"segments\".\"name\"')}",
    );
  });
});
