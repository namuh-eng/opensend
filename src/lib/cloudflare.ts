// ── Types ──────────────────────────────────────────────────────────

export interface DNSRecord {
  type: "TXT" | "MX" | "CNAME";
  name: string;
  content: string;
  ttl: number;
  priority?: number;
}

export interface DNSRecordResult extends DNSRecord {
  id: string;
}

export interface DomainDnsRecord {
  type: string;
  name: string;
  value: string;
  ttl?: string | number;
  priority?: number;
}

export type DNSRecordSyncAction =
  | "created"
  | "updated"
  | "unchanged"
  | "skipped";

export interface DNSRecordSyncResult {
  action: DNSRecordSyncAction;
  name: string;
  type: DNSRecord["type"];
  record?: DNSRecordResult;
  reason?: string;
}

interface CloudflareResponse<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
}

// ── Helpers ────────────────────────────────────────────────────────

function getConfig() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required");
  if (!zoneId) throw new Error("CLOUDFLARE_ZONE_ID is required");

  return { token, zoneId };
}

function baseUrl(zoneId: string) {
  return `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function isSupportedDnsRecordType(type: string): type is DNSRecord["type"] {
  return type === "TXT" || type === "MX" || type === "CNAME";
}

function normalizeTtl(ttl: string | number | undefined): number {
  if (typeof ttl === "number") return ttl;
  if (!ttl || ttl.toLowerCase() === "auto") return 1;
  const parsed = Number(ttl);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function isDmarcRecord(record: DNSRecord): boolean {
  return (
    record.type === "TXT" && record.name.toLowerCase().startsWith("_dmarc.")
  );
}

function dnsRecordsMatch(
  expected: DNSRecord,
  actual: DNSRecordResult,
): boolean {
  return (
    expected.type === actual.type &&
    expected.name === actual.name &&
    expected.content === actual.content &&
    normalizeTtl(actual.ttl) === normalizeTtl(expected.ttl) &&
    (expected.priority ?? null) === (actual.priority ?? null)
  );
}

export function mapDomainRecordToDNSRecord(
  record: DomainDnsRecord,
): DNSRecord | null {
  if (!isSupportedDnsRecordType(record.type)) return null;

  return {
    type: record.type,
    name: record.name,
    content: record.value,
    ttl: normalizeTtl(record.ttl),
    ...(record.priority !== undefined ? { priority: record.priority } : {}),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as CloudflareResponse<T>;
  if (!response.ok || !data.success) {
    const message = data.errors?.[0]?.message ?? "Unknown Cloudflare error";
    throw new Error(`Cloudflare API error: ${message}`);
  }
  return data.result;
}

// ── DNS Record Operations ──────────────────────────────────────────

export async function createDNSRecord(
  record: DNSRecord,
): Promise<DNSRecordResult> {
  const { token, zoneId } = getConfig();

  const body: Record<string, unknown> = {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl,
  };
  if (record.priority !== undefined) {
    body.priority = record.priority;
  }

  const response = await fetch(baseUrl(zoneId), {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  });

  return handleResponse<DNSRecordResult>(response);
}

export async function listDNSRecords(filters?: {
  name?: string;
  type?: string;
}): Promise<DNSRecordResult[]> {
  const { token, zoneId } = getConfig();

  const params = new URLSearchParams();
  if (filters?.name) params.set("name", filters.name);
  if (filters?.type) params.set("type", filters.type);

  const query = params.toString();
  const url = query ? `${baseUrl(zoneId)}?${query}` : baseUrl(zoneId);

  const response = await fetch(url, {
    method: "GET",
    headers: headers(token),
  });

  return handleResponse<DNSRecordResult[]>(response);
}

export async function deleteDNSRecord(recordId: string): Promise<void> {
  if (!recordId) throw new Error("record ID is required");

  const { token, zoneId } = getConfig();

  const response = await fetch(`${baseUrl(zoneId)}/${recordId}`, {
    method: "DELETE",
    headers: headers(token),
  });

  await handleResponse(response);
}

export async function updateDNSRecord(
  recordId: string,
  record: DNSRecord,
): Promise<DNSRecordResult> {
  if (!recordId) throw new Error("record ID is required");

  const { token, zoneId } = getConfig();

  const body: Record<string, unknown> = {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl,
  };
  if (record.priority !== undefined) {
    body.priority = record.priority;
  }

  const response = await fetch(`${baseUrl(zoneId)}/${recordId}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(body),
  });

  return handleResponse<DNSRecordResult>(response);
}

export async function upsertDNSRecord(
  record: DNSRecord,
): Promise<DNSRecordSyncResult> {
  const existing = await listDNSRecords({
    name: record.name,
    type: record.type,
  });
  const current = existing[0];

  if (!current) {
    return {
      action: "created",
      name: record.name,
      type: record.type,
      record: await createDNSRecord(record),
    };
  }

  if (dnsRecordsMatch(record, current)) {
    return {
      action: "unchanged",
      name: record.name,
      type: record.type,
      record: current,
    };
  }

  if (isDmarcRecord(record)) {
    return {
      action: "skipped",
      name: record.name,
      type: record.type,
      record: current,
      reason: "Existing DMARC record is customer-owned and was not overwritten",
    };
  }

  return {
    action: "updated",
    name: record.name,
    type: record.type,
    record: await updateDNSRecord(current.id, record),
  };
}

export async function configureDNSRecords(
  records: DomainDnsRecord[],
): Promise<DNSRecordSyncResult[]> {
  const results: DNSRecordSyncResult[] = [];

  for (const record of records) {
    const dnsRecord = mapDomainRecordToDNSRecord(record);
    if (!dnsRecord) continue;

    results.push(await upsertDNSRecord(dnsRecord));
  }

  return results;
}
