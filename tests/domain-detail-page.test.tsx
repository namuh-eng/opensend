import { beforeEach, describe, expect, it, vi } from "vitest";

const notFoundCalls = vi.hoisted(() => ({ count: 0 }));
const mockNotFound = vi.hoisted(() =>
  vi.fn(() => {
    notFoundCalls.count += 1;
    throw new Error("NEXT_NOT_FOUND");
  }),
);

const limitMock = vi.hoisted(() => vi.fn());
const whereMock = vi.hoisted(() => vi.fn(() => ({ limit: limitMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ where: whereMock })));
const selectMock = vi.hoisted(() => vi.fn(() => ({ from: fromMock })));

vi.mock("@/lib/db", () => ({
  db: { select: selectMock },
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

vi.mock("@/components/domain-detail", () => ({
  DomainDetail: ({ domain }: { domain: { id: string } }) => (
    <div data-testid="domain-detail">{domain.id}</div>
  ),
}));

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

async function importPage() {
  const mod = await import("@/app/(dashboard)/domains/[id]/page");
  return mod.default;
}

describe("DomainDetailPage server component", () => {
  beforeEach(() => {
    vi.resetModules();
    notFoundCalls.count = 0;
    mockNotFound.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();
    whereMock.mockClear();
    limitMock.mockReset();
  });

  it("calls notFound for non-UUID ids without hitting the database", async () => {
    const Page = await importPage();
    await expect(
      Page({ params: Promise.resolve({ id: "not-a-uuid" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalledTimes(1);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("calls notFound when the row is missing", async () => {
    limitMock.mockResolvedValueOnce([]);

    const Page = await importPage();
    await expect(
      Page({ params: Promise.resolve({ id: VALID_UUID }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalledTimes(1);
    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it("propagates database errors instead of masking them as 404", async () => {
    const dbError = new Error("invalid input syntax for type uuid");
    limitMock.mockRejectedValueOnce(dbError);

    const Page = await importPage();
    await expect(
      Page({ params: Promise.resolve({ id: VALID_UUID }) }),
    ).rejects.toBe(dbError);

    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("renders DomainDetail when the row exists", async () => {
    limitMock.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        name: "example.com",
        status: "verified",
        region: "us-east-1",
        trackClicks: false,
        trackOpens: false,
        tls: "opportunistic",
        records: [],
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    ]);

    const Page = await importPage();
    const result = await Page({
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(mockNotFound).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
    expect(result.props.domain.id).toBe(VALID_UUID);
    expect(result.props.domain.events[0].type).toBe("domain_added");
    expect(
      result.props.domain.events.map((e: { type: string }) => e.type),
    ).toContain("domain_verified");
  });
});
