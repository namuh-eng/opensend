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
