import {
  _resetUrlSafetyCacheForTests,
  createWebhookService,
} from "@opensend/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeRow = {
  id: string;
  url: string;
  eventTypes: string[];
  status: "active" | "disabled";
  signingSecretEnc: string | null;
  userId: string;
  createdAt: Date;
};

function makeRepos() {
  const rows: FakeRow[] = [];
  const repository = {
    list: vi.fn(async () => ({ data: rows, hasMore: false })),
    create: vi.fn(
      async (data: Partial<FakeRow> & { userId: string; url: string }) => {
        const row: FakeRow = {
          id: `whk_${rows.length + 1}`,
          url: data.url,
          eventTypes: data.eventTypes ?? [],
          status: "active",
          signingSecretEnc: data.signingSecretEnc ?? null,
          userId: data.userId,
          createdAt: new Date(),
        };
        rows.push(row);
        return [row];
      },
    ),
    findById: vi.fn(async () => undefined),
    update: vi.fn(async () => []),
    delete: vi.fn(async () => []),
  };
  return { rows, repository };
}

describe("webhookService SSRF guards", () => {
  beforeEach(() => {
    _resetUrlSafetyCacheForTests();
    process.env.ALLOW_PRIVATE_WEBHOOK_URLS = undefined;
  });
  afterEach(() => {
    _resetUrlSafetyCacheForTests();
  });

  it("rejects loopback at creation", async () => {
    const { repository } = makeRepos();
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const svc = createWebhookService({ repository: repository as any });
    await expect(
      svc.createWebhook({
        userId: "u1",
        endpoint: "http://127.0.0.1/hook",
        events: ["email.delivered"],
      }),
    ).rejects.toMatchObject({ code: "unsafe_url" });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects AWS metadata IP at creation", async () => {
    const { repository } = makeRepos();
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const svc = createWebhookService({ repository: repository as any });
    await expect(
      svc.createWebhook({
        userId: "u1",
        endpoint: "http://169.254.169.254/latest/meta-data/",
        events: ["email.delivered"],
      }),
    ).rejects.toMatchObject({ code: "unsafe_url" });
  });

  it("rejects file: scheme", async () => {
    const { repository } = makeRepos();
    // biome-ignore lint/suspicious/noExplicitAny: test stub
    const svc = createWebhookService({ repository: repository as any });
    await expect(
      svc.createWebhook({
        userId: "u1",
        endpoint: "file:///etc/passwd",
        events: ["email.delivered"],
      }),
    ).rejects.toMatchObject({ code: "unsafe_url" });
  });
});
