import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock all SES SDK commands ─────────────────────────────────────────────────
const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-sesv2", () => {
  return {
    SESv2Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
    CreateDedicatedIpPoolCommand: vi.fn().mockImplementation((input) => ({
      _name: "CreateDedicatedIpPoolCommand",
      input,
    })),
    DeleteDedicatedIpPoolCommand: vi.fn().mockImplementation((input) => ({
      _name: "DeleteDedicatedIpPoolCommand",
      input,
    })),
    CreateConfigurationSetCommand: vi.fn().mockImplementation((input) => ({
      _name: "CreateConfigurationSetCommand",
      input,
    })),
    PutConfigurationSetDeliveryOptionsCommand: vi
      .fn()
      .mockImplementation((input) => ({
        _name: "PutConfigurationSetDeliveryOptionsCommand",
        input,
      })),
    DeleteConfigurationSetCommand: vi.fn().mockImplementation((input) => ({
      _name: "DeleteConfigurationSetCommand",
      input,
    })),
  };
});

// Force non-dev mode so the real code paths run (stubs are behind dev check)
vi.stubEnv("NODE_ENV", "production");
vi.stubEnv("AWS_ACCESS_KEY_ID", "test-key");
vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret");

import { ConfigurationSetService, tlsPolicyForDomain } from "@opensend/core";

describe("tlsPolicyForDomain", () => {
  it("maps 'required' to REQUIRE", () => {
    expect(tlsPolicyForDomain("required")).toBe("REQUIRE");
  });

  it("maps 'opportunistic' to OPTIONAL", () => {
    expect(tlsPolicyForDomain("opportunistic")).toBe("OPTIONAL");
  });

  it("maps 'enforced' to OPTIONAL (not a SES keyword, treated as non-required)", () => {
    expect(tlsPolicyForDomain("enforced")).toBe("OPTIONAL");
  });

  it("maps null to OPTIONAL", () => {
    expect(tlsPolicyForDomain(null)).toBe("OPTIONAL");
  });
});

describe("ConfigurationSetService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createDedicatedIpPool sends CreateDedicatedIpPoolCommand", async () => {
    mockSend.mockResolvedValueOnce({});
    const svc = new ConfigurationSetService();
    await svc.createDedicatedIpPool({
      poolName: "my-pool",
      scalingMode: "MANAGED",
      region: "us-east-1",
    });
    expect(mockSend).toHaveBeenCalledOnce();
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._name).toBe("CreateDedicatedIpPoolCommand");
    expect(cmd.input.PoolName).toBe("my-pool");
    expect(cmd.input.ScalingMode).toBe("MANAGED");
  });

  it("deleteDedicatedIpPool swallows NotFoundException", async () => {
    const err = new Error("not found");
    (err as Error & { name: string }).name = "NotFoundException";
    mockSend.mockRejectedValueOnce(err);
    const svc = new ConfigurationSetService();
    // Should not throw
    await expect(
      svc.deleteDedicatedIpPool({ poolName: "gone-pool" }),
    ).resolves.toBeUndefined();
  });

  it("syncDomainConfigurationSet creates new set and returns name", async () => {
    mockSend.mockResolvedValueOnce({});
    const svc = new ConfigurationSetService();
    const name = await svc.syncDomainConfigurationSet({
      domainId: "domain-id-123",
      tls: "required",
    });
    expect(name).toBe("opensend-domain-domain-id-123");
    expect(mockSend).toHaveBeenCalledOnce();
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._name).toBe("CreateConfigurationSetCommand");
    expect(cmd.input.DeliveryOptions?.TlsPolicy).toBe("REQUIRE");
  });

  it("syncDomainConfigurationSet updates existing set", async () => {
    mockSend.mockResolvedValueOnce({});
    const svc = new ConfigurationSetService();
    const name = await svc.syncDomainConfigurationSet({
      domainId: "domain-id-123",
      tls: "opportunistic",
      existingConfigSetName: "opensend-domain-domain-id-123",
    });
    expect(name).toBe("opensend-domain-domain-id-123");
    expect(mockSend).toHaveBeenCalledOnce();
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._name).toBe("PutConfigurationSetDeliveryOptionsCommand");
    expect(cmd.input.TlsPolicy).toBe("OPTIONAL");
  });

  it("syncDomainConfigurationSet passes SendingPoolName when pool provided", async () => {
    mockSend.mockResolvedValueOnce({});
    const svc = new ConfigurationSetService();
    await svc.syncDomainConfigurationSet({
      domainId: "domain-id-456",
      tls: "required",
      dedicatedIpPoolSesName: "my-ses-pool",
    });
    expect(mockSend).toHaveBeenCalledOnce();
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._name).toBe("CreateConfigurationSetCommand");
    expect(cmd.input.DeliveryOptions?.SendingPoolName).toBe("my-ses-pool");
  });

  it("syncDomainConfigurationSet handles AlreadyExistsException on create by updating", async () => {
    const existsErr = new Error("already exists");
    (existsErr as Error & { name: string }).name = "AlreadyExistsException";
    mockSend
      .mockRejectedValueOnce(existsErr) // CreateConfigurationSet fails
      .mockResolvedValueOnce({}); // PutConfigurationSetDeliveryOptions succeeds
    const svc = new ConfigurationSetService();
    const name = await svc.syncDomainConfigurationSet({
      domainId: "domain-id-789",
      tls: "opportunistic",
    });
    expect(name).toBe("opensend-domain-domain-id-789");
    expect(mockSend).toHaveBeenCalledTimes(2);
    const updateCmd = mockSend.mock.calls[1][0];
    expect(updateCmd._name).toBe("PutConfigurationSetDeliveryOptionsCommand");
  });
});
