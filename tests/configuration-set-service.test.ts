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
    GetDedicatedIpPoolCommand: vi.fn().mockImplementation((input) => ({
      _name: "GetDedicatedIpPoolCommand",
      input,
    })),
    GetDedicatedIpsCommand: vi.fn().mockImplementation((input) => ({
      _name: "GetDedicatedIpsCommand",
      input,
    })),
    CreateConfigurationSetCommand: vi.fn().mockImplementation((input) => ({
      _name: "CreateConfigurationSetCommand",
      input,
    })),
    CreateConfigurationSetEventDestinationCommand: vi
      .fn()
      .mockImplementation((input) => ({
        _name: "CreateConfigurationSetEventDestinationCommand",
        input,
      })),
    GetConfigurationSetEventDestinationsCommand: vi
      .fn()
      .mockImplementation((input) => ({
        _name: "GetConfigurationSetEventDestinationsCommand",
        input,
      })),
    PutConfigurationSetDeliveryOptionsCommand: vi
      .fn()
      .mockImplementation((input) => ({
        _name: "PutConfigurationSetDeliveryOptionsCommand",
        input,
      })),
    UpdateConfigurationSetEventDestinationCommand: vi
      .fn()
      .mockImplementation((input) => ({
        _name: "UpdateConfigurationSetEventDestinationCommand",
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

  it("getDedicatedIpPool returns pool data from SES response", async () => {
    mockSend.mockResolvedValueOnce({
      DedicatedIpPool: { PoolName: "my-pool", ScalingMode: "MANAGED" },
    });
    const svc = new ConfigurationSetService();
    const result = await svc.getDedicatedIpPool({
      poolName: "my-pool",
      region: "us-east-1",
    });
    expect(result).toEqual({ poolName: "my-pool", scalingMode: "MANAGED" });
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._name).toBe("GetDedicatedIpPoolCommand");
    expect(cmd.input.PoolName).toBe("my-pool");
  });

  it("getDedicatedIpPool returns null on NotFoundException", async () => {
    const err = new Error("not found");
    (err as Error & { name: string }).name = "NotFoundException";
    mockSend.mockRejectedValueOnce(err);
    const svc = new ConfigurationSetService();
    const result = await svc.getDedicatedIpPool({ poolName: "gone-pool" });
    expect(result).toBeNull();
  });

  it("getDedicatedIps returns mapped IP array", async () => {
    mockSend.mockResolvedValueOnce({
      DedicatedIps: [
        { Ip: "1.2.3.4", WarmupStatus: "NOT_APPLICABLE" },
        { Ip: "5.6.7.8", WarmupStatus: "IN_PROGRESS" },
      ],
      NextToken: undefined,
    });
    const svc = new ConfigurationSetService();
    const ips = await svc.getDedicatedIps({ poolName: "my-pool" });
    expect(ips).toEqual([
      { ip: "1.2.3.4", warmupStatus: "NOT_APPLICABLE" },
      { ip: "5.6.7.8", warmupStatus: "IN_PROGRESS" },
    ]);
  });

  it("getDedicatedIps returns empty array on NotFoundException", async () => {
    const err = new Error("not found");
    (err as Error & { name: string }).name = "NotFoundException";
    mockSend.mockRejectedValueOnce(err);
    const svc = new ConfigurationSetService();
    const ips = await svc.getDedicatedIps({ poolName: "gone-pool" });
    expect(ips).toEqual([]);
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

  it("syncDomainConfigurationSet creates an SNS event destination when a topic ARN is configured", async () => {
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ EventDestinations: [] })
      .mockResolvedValueOnce({});
    const svc = new ConfigurationSetService();

    await svc.syncDomainConfigurationSet({
      domainId: "domain-id-events",
      tls: "required",
      eventDestinationTopicArn:
        "arn:aws:sns:us-east-1:123456789012:opensend-ses-events",
    });

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockSend.mock.calls[1][0]._name).toBe(
      "GetConfigurationSetEventDestinationsCommand",
    );
    const destinationCmd = mockSend.mock.calls[2][0];
    expect(destinationCmd._name).toBe(
      "CreateConfigurationSetEventDestinationCommand",
    );
    expect(destinationCmd.input).toMatchObject({
      ConfigurationSetName: "opensend-domain-domain-id-events",
      EventDestinationName: "opensend-sns-events",
      EventDestination: {
        Enabled: true,
        MatchingEventTypes: [
          "SEND",
          "DELIVERY",
          "BOUNCE",
          "COMPLAINT",
          "DELIVERY_DELAY",
          "REJECT",
          "RENDERING_FAILURE",
        ],
        SnsDestination: {
          TopicArn: "arn:aws:sns:us-east-1:123456789012:opensend-ses-events",
        },
      },
    });
  });

  it("syncDomainConfigurationSet updates an existing SNS event destination", async () => {
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        EventDestinations: [{ Name: "opensend-sns-events" }],
      })
      .mockResolvedValueOnce({});
    const svc = new ConfigurationSetService();

    await svc.syncDomainConfigurationSet({
      domainId: "domain-id-events",
      tls: "opportunistic",
      existingConfigSetName: "opensend-domain-domain-id-events",
      eventDestinationTopicArn:
        "arn:aws:sns:us-east-1:123456789012:opensend-ses-events",
    });

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockSend.mock.calls[0][0]._name).toBe(
      "PutConfigurationSetDeliveryOptionsCommand",
    );
    expect(mockSend.mock.calls[1][0]._name).toBe(
      "GetConfigurationSetEventDestinationsCommand",
    );
    expect(mockSend.mock.calls[2][0]._name).toBe(
      "UpdateConfigurationSetEventDestinationCommand",
    );
  });

  it("reads the configured SNS event destination state", async () => {
    mockSend.mockResolvedValueOnce({
      EventDestinations: [
        {
          Name: "opensend-sns-events",
          Enabled: true,
          SnsDestination: {
            TopicArn: "arn:aws:sns:us-east-1:123456789012:opensend-ses-events",
          },
          MatchingEventTypes: ["SEND", "DELIVERY"],
        },
      ],
    });
    const svc = new ConfigurationSetService();

    await expect(
      svc.getConfigurationSetEventDestinationState({
        configurationSetName: "opensend-domain-domain-id-events",
      }),
    ).resolves.toEqual({
      configured: true,
      enabled: true,
      topicArn: "arn:aws:sns:us-east-1:123456789012:opensend-ses-events",
      matchingEventTypes: ["SEND", "DELIVERY"],
    });
  });
});
