import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.hoisted(() => vi.fn());
const mockHeaders = vi.hoisted(() => vi.fn());
const mockCreateInvitesService = vi.hoisted(() => vi.fn());
const mockListMembers = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@opensend/core", () => ({
  createInvitesService: mockCreateInvitesService,
}));

const createdAt = new Date("2026-05-10T12:00:00.000Z");

async function importRoute() {
  return import("@/app/api/invites/route");
}

describe("invites route adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers({ cookie: "session=test" }));
    mockGetSession.mockResolvedValue({
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
    mockListMembers.mockResolvedValue({
      object: "list",
      data: [],
    });
    mockCreateInvitesService.mockReturnValue({
      listMembers: mockListMembers,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps dashboard session auth in the adapter and returns the service envelope", async () => {
    mockListMembers.mockResolvedValue({
      object: "list",
      data: [
        {
          id: "user-1",
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: "admin",
          created_at: createdAt,
        },
      ],
    });

    const route = await importRoute();
    const response = await route.GET();

    expect(response.status).toBe(200);
    expect(mockHeaders).toHaveBeenCalledOnce();
    expect(mockGetSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
    expect(mockCreateInvitesService).toHaveBeenCalledOnce();
    expect(mockListMembers).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "user-1",
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: "admin",
          created_at: "2026-05-10T12:00:00.000Z",
        },
      ],
    });
  });

  it("returns the existing unauthorized response without calling the service", async () => {
    mockGetSession.mockResolvedValue(null);

    const route = await importRoute();
    const response = await route.GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockListMembers).not.toHaveBeenCalled();
  });

  it("keeps service failure logging and HTTP 500 mapping in the adapter", async () => {
    const error = new Error("db down");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockListMembers.mockRejectedValue(error);

    const route = await importRoute();
    const response = await route.GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to fetch members:",
      error,
    );
  });
});
