import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CreateConfigurationSetCommand,
  CreateDedicatedIpPoolCommand,
  DeleteConfigurationSetCommand,
  DeleteDedicatedIpPoolCommand,
  PutConfigurationSetDeliveryOptionsCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";

const hasAwsCredentials =
  !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
  !!process.env.AWS_PROFILE ||
  existsSync(join(process.env.HOME ?? "", ".aws", "credentials"));

const useDevStub = process.env.NODE_ENV === "development" && !hasAwsCredentials;

const DEFAULT_SES_REGION = "us-east-1";

function normalizeSesRegion(region: string | null | undefined): string {
  const trimmed = region?.trim();
  return trimmed || DEFAULT_SES_REGION;
}

/**
 * Maps opensend tls field values to the SES TlsPolicy enum.
 * 'required' → REQUIRE, anything else → OPTIONAL.
 */
export function tlsPolicyForDomain(
  tls: string | null | undefined,
): "REQUIRE" | "OPTIONAL" {
  return tls === "required" ? "REQUIRE" : "OPTIONAL";
}

export type DedicatedIpScalingMode = "STANDARD" | "MANAGED";

export class ConfigurationSetService {
  private readonly clients = new Map<string, SESv2Client>();

  private getClient(region?: string | null): SESv2Client {
    const resolved = normalizeSesRegion(region);
    const cached = this.clients.get(resolved);
    if (cached) return cached;
    const client = new SESv2Client({ region: resolved });
    this.clients.set(resolved, client);
    return client;
  }

  /**
   * Create a dedicated IP pool in SES.
   */
  async createDedicatedIpPool(input: {
    poolName: string;
    scalingMode?: DedicatedIpScalingMode;
    region?: string;
  }): Promise<void> {
    if (useDevStub) {
      console.log(
        `[DEV] Would create SES dedicated IP pool: ${input.poolName} (${input.scalingMode ?? "MANAGED"})`,
      );
      return;
    }
    await this.getClient(input.region).send(
      new CreateDedicatedIpPoolCommand({
        PoolName: input.poolName,
        ScalingMode: input.scalingMode ?? "MANAGED",
      }),
    );
  }

  /**
   * Delete a dedicated IP pool from SES (best-effort, ignores not-found).
   */
  async deleteDedicatedIpPool(input: {
    poolName: string;
    region?: string;
  }): Promise<void> {
    if (useDevStub) {
      console.log(
        `[DEV] Would delete SES dedicated IP pool: ${input.poolName}`,
      );
      return;
    }
    try {
      await this.getClient(input.region).send(
        new DeleteDedicatedIpPoolCommand({ PoolName: input.poolName }),
      );
    } catch (err) {
      if (!isNotFoundException(err)) throw err;
    }
  }

  /**
   * Create a SES configuration set for a domain.
   * Names convention: `opensend-domain-<domainId>`.
   */
  async createConfigurationSet(input: {
    configurationSetName: string;
    tlsPolicy?: "REQUIRE" | "OPTIONAL";
    sendingPoolName?: string | null;
    region?: string;
  }): Promise<void> {
    if (useDevStub) {
      console.log(
        `[DEV] Would create SES config set: ${input.configurationSetName} (TLS=${input.tlsPolicy ?? "OPTIONAL"}, pool=${input.sendingPoolName ?? "none"})`,
      );
      return;
    }
    await this.getClient(input.region).send(
      new CreateConfigurationSetCommand({
        ConfigurationSetName: input.configurationSetName,
        DeliveryOptions: {
          TlsPolicy: input.tlsPolicy ?? "OPTIONAL",
          ...(input.sendingPoolName
            ? { SendingPoolName: input.sendingPoolName }
            : {}),
        },
      }),
    );
  }

  /**
   * Update the DeliveryOptions on an existing SES configuration set.
   */
  async updateConfigurationSetDeliveryOptions(input: {
    configurationSetName: string;
    tlsPolicy: "REQUIRE" | "OPTIONAL";
    sendingPoolName?: string | null;
    region?: string;
  }): Promise<void> {
    if (useDevStub) {
      console.log(
        `[DEV] Would update SES config set delivery options: ${input.configurationSetName} (TLS=${input.tlsPolicy}, pool=${input.sendingPoolName ?? "none"})`,
      );
      return;
    }
    await this.getClient(input.region).send(
      new PutConfigurationSetDeliveryOptionsCommand({
        ConfigurationSetName: input.configurationSetName,
        TlsPolicy: input.tlsPolicy,
        ...(input.sendingPoolName !== undefined
          ? { SendingPoolName: input.sendingPoolName ?? undefined }
          : {}),
      }),
    );
  }

  /**
   * Delete a SES configuration set (best-effort, ignores not-found).
   */
  async deleteConfigurationSet(input: {
    configurationSetName: string;
    region?: string;
  }): Promise<void> {
    if (useDevStub) {
      console.log(
        `[DEV] Would delete SES config set: ${input.configurationSetName}`,
      );
      return;
    }
    try {
      await this.getClient(input.region).send(
        new DeleteConfigurationSetCommand({
          ConfigurationSetName: input.configurationSetName,
        }),
      );
    } catch (err) {
      if (!isNotFoundException(err)) throw err;
    }
  }

  /**
   * Ensure a SES configuration set exists for a domain and keep its
   * DeliveryOptions in sync with the current tls + pool assignment.
   * Returns the configuration set name.
   */
  async syncDomainConfigurationSet(input: {
    domainId: string;
    tls: string | null | undefined;
    dedicatedIpPoolSesName?: string | null;
    existingConfigSetName?: string | null;
    region?: string;
  }): Promise<string> {
    const configSetName =
      input.existingConfigSetName ?? `opensend-domain-${input.domainId}`;
    const tlsPolicy = tlsPolicyForDomain(input.tls);
    const sendingPoolName = input.dedicatedIpPoolSesName ?? null;

    if (input.existingConfigSetName) {
      // Update existing set
      await this.updateConfigurationSetDeliveryOptions({
        configurationSetName: configSetName,
        tlsPolicy,
        sendingPoolName,
        region: input.region,
      });
    } else {
      // Create new set (idempotent: ignore already-exists)
      try {
        await this.createConfigurationSet({
          configurationSetName: configSetName,
          tlsPolicy,
          sendingPoolName,
          region: input.region,
        });
      } catch (err) {
        if (!isAlreadyExistsError(err)) throw err;
        // Already exists — bring options in sync anyway
        await this.updateConfigurationSetDeliveryOptions({
          configurationSetName: configSetName,
          tlsPolicy,
          sendingPoolName,
          region: input.region,
        });
      }
    }

    return configSetName;
  }
}

function isNotFoundException(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ((error as { name: string }).name === "NotFoundException" ||
      (error as { name: string }).name === "NoSuchConfigurationSet")
  );
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "AlreadyExistsException"
  );
}

export const configurationSetService = new ConfigurationSetService();
