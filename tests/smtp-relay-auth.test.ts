import { describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockValidateApiKeyRaw = vi.hoisted(() => vi.fn());

vi.mock("@opensend/core", () => ({
  validateApiKeyRaw: mockValidateApiKeyRaw,
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe("authenticateSmtpSession", () => {
  it("returns null when password is empty", async () => {
    mockValidateApiKeyRaw.mockResolvedValue(null);

    const { authenticateSmtpSession } = await import(
      "../packages/smtp-relay/src/auth"
    );

    const result = await authenticateSmtpSession("apikey", "");
    expect(result).toBeNull();
  });

  it("returns null when password is not a valid API key", async () => {
    mockValidateApiKeyRaw.mockResolvedValue(null);

    const { authenticateSmtpSession } = await import(
      "../packages/smtp-relay/src/auth"
    );

    const result = await authenticateSmtpSession("apikey", "not-a-real-key");
    expect(result).toBeNull();
    expect(mockValidateApiKeyRaw).toHaveBeenCalledWith("not-a-real-key");
  });

  it("returns null when password is null", async () => {
    mockValidateApiKeyRaw.mockResolvedValue(null);

    const { authenticateSmtpSession } = await import(
      "../packages/smtp-relay/src/auth"
    );

    const result = await authenticateSmtpSession("apikey", null);
    expect(result).toBeNull();
  });

  it("returns auth result when API key is valid", async () => {
    const authResult = {
      userId: "user-1",
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
    };
    mockValidateApiKeyRaw.mockResolvedValue(authResult);

    const { authenticateSmtpSession } = await import(
      "../packages/smtp-relay/src/auth"
    );

    const result = await authenticateSmtpSession("apikey", "os_live_abc123");
    expect(result).toEqual(authResult);
    expect(mockValidateApiKeyRaw).toHaveBeenCalledWith("os_live_abc123");
  });

  it("ignores the username field entirely — password is the only auth factor", async () => {
    const authResult = {
      userId: "user-2",
      apiKeyId: "key-2",
      permission: "full_access",
      domain: null,
    };
    mockValidateApiKeyRaw.mockResolvedValue(authResult);

    const { authenticateSmtpSession } = await import(
      "../packages/smtp-relay/src/auth"
    );

    // Different usernames, same password — both should succeed
    const r1 = await authenticateSmtpSession("user@example.com", "os_live_abc");
    const r2 = await authenticateSmtpSession("anything", "os_live_abc");
    expect(r1).toEqual(authResult);
    expect(r2).toEqual(authResult);
    // validateApiKeyRaw should only see the password
    expect(mockValidateApiKeyRaw).toHaveBeenCalledWith("os_live_abc");
  });
});
