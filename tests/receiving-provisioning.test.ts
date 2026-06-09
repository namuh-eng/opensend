import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSend = vi.hoisted(() => vi.fn());
const command = vi.hoisted(
  () => (name: string) =>
    vi.fn().mockImplementation((input: unknown) => ({ _name: name, input })),
);

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  CreateReceiptRuleCommand: command("CreateReceiptRuleCommand"),
  CreateReceiptRuleSetCommand: command("CreateReceiptRuleSetCommand"),
  DeleteReceiptRuleCommand: command("DeleteReceiptRuleCommand"),
  DescribeReceiptRuleCommand: command("DescribeReceiptRuleCommand"),
  SetActiveReceiptRuleSetCommand: command("SetActiveReceiptRuleSetCommand"),
  UpdateReceiptRuleCommand: command("UpdateReceiptRuleCommand"),
}));

vi.stubEnv("NODE_ENV", "production");
vi.stubEnv("AWS_ACCESS_KEY_ID", "test-key");
vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret");

import {
  ReceivingProvisioningError,
  ReceivingProvisioningService,
  buildInboundObjectPrefix,
  buildReceivingReceiptRuleName,
} from "@opensend/core";

const config = {
  ruleSetName: "opensend-inbound",
  bucketName: "opensend-raw-mail",
  topicArn: "arn:aws:sns:us-east-1:123456789012:opensend-inbound-mail",
  objectKeyPrefixForDomain: buildInboundObjectPrefix,
};

function missingRuleError() {
  const error = new Error("missing");
  (error as Error & { name: string }).name = "RuleDoesNotExistException";
  return error;
}

describe("receiving provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds SES-safe stable receipt rule names", () => {
    expect(buildReceivingReceiptRuleName("Inbound.Example.com")).toBe(
      "opensend-inbound.example.com",
    );
    expect(
      buildReceivingReceiptRuleName(
        "very-long-subdomain-for-customer-mail-routing.example.com",
      ),
    ).toMatch(
      /^opensend-very-long-subdomain-for-customer-mail-routin-[a-f0-9]{10}$/,
    );
  });

  it("creates the active rule set and receipt rule for a new receiving domain", async () => {
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(missingRuleError())
      .mockResolvedValueOnce({});
    const service = new ReceivingProvisioningService(() => config);

    await expect(
      service.provisionDomain({
        domainName: "Inbound.Example.com",
        region: "us-east-1",
      }),
    ).resolves.toEqual({
      ruleSetName: "opensend-inbound",
      ruleName: "opensend-inbound.example.com",
      action: "created",
    });

    expect(mockSend).toHaveBeenCalledTimes(4);
    expect(mockSend.mock.calls.map(([cmd]) => cmd._name)).toEqual([
      "CreateReceiptRuleSetCommand",
      "SetActiveReceiptRuleSetCommand",
      "DescribeReceiptRuleCommand",
      "CreateReceiptRuleCommand",
    ]);
    expect(mockSend.mock.calls[3][0].input).toMatchObject({
      RuleSetName: "opensend-inbound",
      Rule: {
        Name: "opensend-inbound.example.com",
        Enabled: true,
        Recipients: ["inbound.example.com"],
        ScanEnabled: true,
        Actions: [
          {
            S3Action: {
              BucketName: "opensend-raw-mail",
              ObjectKeyPrefix: "ses-inbound/inbound.example.com/",
              TopicArn:
                "arn:aws:sns:us-east-1:123456789012:opensend-inbound-mail",
            },
          },
        ],
      },
    });
  });

  it("updates an existing receipt rule when the domain is already provisioned", async () => {
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const service = new ReceivingProvisioningService(() => config);

    await expect(
      service.provisionDomain({ domainName: "inbound.example.com" }),
    ).resolves.toMatchObject({ action: "updated" });

    expect(mockSend.mock.calls.map(([cmd]) => cmd._name)).toEqual([
      "CreateReceiptRuleSetCommand",
      "SetActiveReceiptRuleSetCommand",
      "DescribeReceiptRuleCommand",
      "UpdateReceiptRuleCommand",
    ]);
  });

  it("deletes the domain receipt rule and treats missing rules as a no-op", async () => {
    mockSend.mockRejectedValueOnce(missingRuleError());
    const service = new ReceivingProvisioningService(() => config);

    await expect(
      service.deprovisionDomain({ domainName: "inbound.example.com" }),
    ).resolves.toEqual({
      ruleSetName: "opensend-inbound",
      ruleName: "opensend-inbound.example.com",
      action: "noop",
    });
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      _name: "DeleteReceiptRuleCommand",
      input: {
        RuleSetName: "opensend-inbound",
        RuleName: "opensend-inbound.example.com",
      },
    });
  });

  it("can deprovision even when bucket and topic config are missing", async () => {
    vi.stubEnv("SES_INBOUND_SNS_TOPIC_ARN", "");
    vi.stubEnv("SES_INBOUND_BUCKET_NAME", "");
    vi.stubEnv("S3_BUCKET_NAME", "");
    mockSend.mockResolvedValueOnce({});
    const service = new ReceivingProvisioningService();

    await expect(
      service.deprovisionDomain({ domainName: "inbound.example.com" }),
    ).resolves.toEqual({
      ruleSetName: "opensend-inbound",
      ruleName: "opensend-inbound.example.com",
      action: "deleted",
    });
  });

  it("fails before AWS calls when hosted receiving config is missing", async () => {
    vi.stubEnv("SES_INBOUND_SNS_TOPIC_ARN", "");
    vi.stubEnv("SES_INBOUND_BUCKET_NAME", "");
    vi.stubEnv("S3_BUCKET_NAME", "");
    const service = new ReceivingProvisioningService();

    await expect(
      service.provisionDomain({ domainName: "inbound.example.com" }),
    ).rejects.toBeInstanceOf(ReceivingProvisioningError);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
