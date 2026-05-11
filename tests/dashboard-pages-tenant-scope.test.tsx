import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockRedirect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
);
const mockNotFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const mockSelect = vi.hoisted(() => vi.fn());
const mockFindSuppression = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() =>
  vi.fn((left, right) => ({ kind: "eq", left, right })),
);
const mockAnd = vi.hoisted(() =>
  vi.fn((...conditions) => ({ kind: "and", conditions })),
);
const mockDesc = vi.hoisted(() =>
  vi.fn((column) => ({ kind: "desc", column })),
);
const recordedWhere = vi.hoisted(() => [] as unknown[]);

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
  redirect: mockRedirect,
}));

vi.mock("drizzle-orm", async () => {
  const actual =
    await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    and: mockAnd,
    desc: mockDesc,
    eq: mockEq,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      emailSuppressions: {
        findFirst: mockFindSuppression,
      },
    },
    select: mockSelect,
  },
}));

vi.mock("@/components/emails-sending-page", () => ({
  EmailsSendingPage: (props: {
    emails: unknown[];
    apiKeys: unknown[];
    hasAnyEmails: boolean;
  }) => <div data-testid="emails-page" data-props={JSON.stringify(props)} />,
}));

vi.mock("@/components/email-detail", () => ({
  EmailDetail: (props: { email: { id: string } }) => (
    <div data-testid="email-detail" data-props={JSON.stringify(props)} />
  ),
}));

vi.mock("@/components/api-keys-list", () => ({
  ApiKeysList: (props: { keys: unknown[]; domains: unknown[] }) => (
    <div data-testid="api-keys-page" data-props={JSON.stringify(props)} />
  ),
}));

vi.mock("@/components/api-key-detail", () => ({
  ApiKeyDetail: (props: { apiKey: { id: string }; domains: unknown[] }) => (
    <div data-testid="api-key-detail" data-props={JSON.stringify(props)} />
  ),
}));

vi.mock("@/components/webhooks-list", () => ({
  WebhooksList: (props: { webhooks: unknown[] }) => (
    <div data-testid="webhooks-page" data-props={JSON.stringify(props)} />
  ),
}));

vi.mock("@/components/logs-list-page", () => ({
  LogsListPage: (props: { logs: unknown[] }) => (
    <div data-testid="logs-page" data-props={JSON.stringify(props)} />
  ),
}));

vi.mock("@/components/log-detail", () => ({
  LogDetail: (props: { log: { id: string } }) => (
    <div data-testid="log-detail" data-props={JSON.stringify(props)} />
  ),
}));

function makeQuery<T>(rows: T[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn((condition: unknown) => {
      recordedWhere.push(condition);
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
    // biome-ignore lint/suspicious/noThenProperty: mocks Drizzle's thenable query builder
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(resolve(rows)),
  };
  return chain;
}

function queueRows(...rowSets: unknown[][]) {
  mockSelect.mockReset();
  for (const rows of rowSets) {
    mockSelect.mockReturnValueOnce(makeQuery(rows));
  }
}

type TestElement = { props: Record<string, unknown> };

function isTestElement(value: unknown): value is TestElement {
  return (
    typeof value === "object" &&
    value !== null &&
    "props" in value &&
    typeof value.props === "object" &&
    value.props !== null
  );
}

function parsedProps<T>(element: TestElement): T {
  const child = element.props.children ?? element;
  if (Array.isArray(child)) {
    const match = child.find(
      (item) => isTestElement(item) && item.props["data-props"] !== undefined,
    );
    if (isTestElement(match)) {
      return JSON.parse(match.props["data-props"] as string) as T;
    }
    const propChild = child.find(
      (item) =>
        isTestElement(item) &&
        [
          "emails",
          "apiKeys",
          "keys",
          "domains",
          "webhooks",
          "logs",
          "log",
          "apiKey",
          "email",
        ].some((key) => item.props[key] !== undefined),
    );
    if (!isTestElement(propChild)) throw new Error("Expected props child");
    return propChild.props as T;
  }
  if (!isTestElement(child)) throw new Error("Expected test element");
  if (child.props["data-props"] !== undefined) {
    return JSON.parse(child.props["data-props"] as string) as T;
  }
  return child.props as T;
}

type DashboardPageFn = (props: {
  params?: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string>>;
}) => Promise<unknown>;

async function expectRedirectsToAuth(
  importer: () => Promise<{ default: unknown }>,
) {
  mockGetServerSession.mockResolvedValueOnce(null);
  const Page = (await importer()).default as DashboardPageFn;

  await expect(
    Page({
      params: Promise.resolve({ id: "owned-id" }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NEXT_REDIRECT");

  expect(mockRedirect).toHaveBeenCalledWith("/auth");
  expect(mockSelect).not.toHaveBeenCalled();
}

describe("dashboard pages tenant scoping", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    recordedWhere.length = 0;
    mockGetServerSession.mockResolvedValue({ user: { id: "user-b" } });
    mockFindSuppression.mockResolvedValue(null);
  });

  it("redirects unauthenticated dashboard pages before querying", async () => {
    await expectRedirectsToAuth(() => import("@/app/(dashboard)/emails/page"));
    await expectRedirectsToAuth(
      () => import("@/app/(dashboard)/api-keys/page"),
    );
    await expectRedirectsToAuth(
      () => import("@/app/(dashboard)/webhooks/page"),
    );
    await expectRedirectsToAuth(() => import("@/app/(dashboard)/logs/page"));
  });

  it("renders empty list data for user B when scoped page queries return no owned rows", async () => {
    queueRows([], [], []);
    const EmailsPage = (await import("@/app/(dashboard)/emails/page")).default;
    const emailsResult = await EmailsPage({
      searchParams: Promise.resolve({}),
    });
    const emailsProps = parsedProps<{
      emails: unknown[];
      apiKeys: unknown[];
      hasAnyEmails: boolean;
    }>(emailsResult);
    expect(emailsProps.emails).toEqual([]);
    expect(emailsProps.hasAnyEmails).toBe(false);

    queueRows([], []);
    const ApiKeysPage = (await import("@/app/(dashboard)/api-keys/page"))
      .default;
    const apiKeysResult = await ApiKeysPage();
    expect(parsedProps<{ keys: unknown[] }>(apiKeysResult).keys).toEqual([]);

    queueRows([]);
    const WebhooksPage = (await import("@/app/(dashboard)/webhooks/page"))
      .default;
    const webhooksResult = await WebhooksPage();
    expect(
      parsedProps<{ webhooks: unknown[] }>(webhooksResult).webhooks,
    ).toEqual([]);

    queueRows([]);
    const LogsPage = (await import("@/app/(dashboard)/logs/page")).default;
    const logsResult = await LogsPage({ searchParams: Promise.resolve({}) });
    expect(parsedProps<{ logs: unknown[] }>(logsResult).logs).toEqual([]);

    expect(mockEq.mock.calls.some(([, right]) => right === "user-b")).toBe(
      true,
    );
  });

  it("404s detail pages for user B when owned-row predicates return no rows", async () => {
    queueRows([]);
    const EmailDetailPage = (await import("@/app/(dashboard)/emails/[id]/page"))
      .default;
    await expect(
      EmailDetailPage({ params: Promise.resolve({ id: "email-a" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    queueRows([]);
    const ApiKeyDetailPage = (
      await import("@/app/(dashboard)/api-keys/[id]/page")
    ).default;
    await expect(
      ApiKeyDetailPage({ params: Promise.resolve({ id: "key-a" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    queueRows([]);
    const LogDetailPage = (await import("@/app/(dashboard)/logs/[id]/page"))
      .default;
    await expect(
      LogDetailPage({ params: Promise.resolve({ id: "log-a" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(
      mockEq.mock.calls.filter(([, right]) => right === "user-b").length,
    ).toBeGreaterThanOrEqual(3);
  });
});
