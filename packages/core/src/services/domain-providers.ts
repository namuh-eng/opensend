import { emailProvider } from "./emailProvider";

type CreateDomainIdentityOptions = Parameters<
  typeof emailProvider.createDomainIdentity
>[1];

type CreateDomainIdentityReturn = ReturnType<
  typeof emailProvider.createDomainIdentity
>;

export type DomainIdentityProvider = {
  createDomainIdentity(
    domain: string,
    options?: CreateDomainIdentityOptions,
  ): CreateDomainIdentityReturn;
  getDomainIdentity: typeof emailProvider.getDomainIdentity;
  deleteDomainIdentity: typeof emailProvider.deleteDomainIdentity;
  setMailFromDomain: typeof emailProvider.setMailFromDomain;
};

export type DomainDnsCleanupRecord = {
  id: string;
  name: string;
  content: string;
};

type CloudflareResponse<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
};

export type DomainDnsCleanupProvider = {
  listDNSRecords(filters?: {
    name?: string;
    type?: string;
  }): Promise<DomainDnsCleanupRecord[]>;
  deleteDNSRecord(recordId: string): Promise<void>;
};

function getCloudflareConfig() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required");
  if (!zoneId) throw new Error("CLOUDFLARE_ZONE_ID is required");

  return { token, zoneId };
}

function cloudflareDnsRecordsUrl(zoneId: string): string {
  return `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
}

function cloudflareHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function readCloudflareResult<T>(response: Response): Promise<T> {
  const data = (await response.json()) as CloudflareResponse<T>;
  if (!response.ok || !data.success) {
    const message = data.errors?.[0]?.message ?? "Unknown Cloudflare error";
    throw new Error(`Cloudflare API error: ${message}`);
  }

  return data.result;
}

export const domainIdentityProvider: DomainIdentityProvider = {
  createDomainIdentity: (domain, options) =>
    emailProvider.createDomainIdentity(domain, options),
  getDomainIdentity: (domain, options) =>
    emailProvider.getDomainIdentity(domain, options),
  deleteDomainIdentity: (domain, options) =>
    emailProvider.deleteDomainIdentity(domain, options),
  setMailFromDomain: (domain, mailFromDomain, options) =>
    emailProvider.setMailFromDomain(domain, mailFromDomain, options),
};

export const cloudflareDnsCleanupProvider: DomainDnsCleanupProvider = {
  async listDNSRecords(filters) {
    const { token, zoneId } = getCloudflareConfig();
    const params = new URLSearchParams();
    if (filters?.name) params.set("name", filters.name);
    if (filters?.type) params.set("type", filters.type);

    const query = params.toString();
    const url = query
      ? `${cloudflareDnsRecordsUrl(zoneId)}?${query}`
      : cloudflareDnsRecordsUrl(zoneId);

    const response = await fetch(url, {
      method: "GET",
      headers: cloudflareHeaders(token),
    });

    return readCloudflareResult<DomainDnsCleanupRecord[]>(response);
  },

  async deleteDNSRecord(recordId) {
    if (!recordId) throw new Error("record ID is required");

    const { token, zoneId } = getCloudflareConfig();
    const response = await fetch(
      `${cloudflareDnsRecordsUrl(zoneId)}/${recordId}`,
      {
        method: "DELETE",
        headers: cloudflareHeaders(token),
      },
    );

    await readCloudflareResult(response);
  },
};
