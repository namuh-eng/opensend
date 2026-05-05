import { DMARC_RECORD_VALUE, buildDmarcRecordName } from "@opensend/core";

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

function buildReturnPathRecordName(
  domainName: string,
  customReturnPath: string | null | undefined,
): string {
  return `${customReturnPath?.trim() || "send"}.${domainName}`;
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

// ── Auto-configure Domain ──────────────────────────────────────────

export interface AutoConfigureResult {
  records: DNSRecordResult[];
  warnings: string[];
}

export async function autoConfigureDomain(
  domain: string,
  dkimTokens: string[],
  customReturnPath?: string | null,
): Promise<AutoConfigureResult> {
  if (!domain) throw new Error("domain is required");
  if (!dkimTokens || dkimTokens.length === 0)
    throw new Error("DKIM tokens are required");

  const returnPathRecordName = buildReturnPathRecordName(
    domain,
    customReturnPath,
  );
  const warnings: string[] = [];
  const results: DNSRecordResult[] = [];

  const dmarcRecordName = buildDmarcRecordName(domain);

  // Check existing MX, SPF TXT, and DMARC TXT records before creating anything
  const [existingMX, existingTXT, existingDmarcTXT] = await Promise.all([
    listDNSRecords({ name: returnPathRecordName, type: "MX" }),
    listDNSRecords({ name: returnPathRecordName, type: "TXT" }),
    listDNSRecords({ name: dmarcRecordName, type: "TXT" }),
  ]);

  // DKIM CNAME records — skip gracefully if already exist
  const dkimResults = await Promise.all(
    dkimTokens.map((token) =>
      createDNSRecord({
        type: "CNAME",
        name: `${token}._domainkey.${domain}`,
        content: `${token}.dkim.amazonses.com`,
        ttl: 300,
      }).catch(() => null),
    ),
  );
  results.push(...dkimResults.filter((r): r is DNSRecordResult => r !== null));

  // SPF TXT record — merge into existing if one is found
  const existingSPF = existingTXT.find((r) =>
    r.content.replace(/^"|"$/g, "").startsWith("v=spf1"),
  );
  if (existingSPF) {
    const spfContent = existingSPF.content.replace(/^"|"$/g, "");
    if (spfContent.includes("amazonses.com")) {
      warnings.push("SPF record already includes amazonses.com — skipped");
    } else {
      const merged = spfContent.replace(
        /\s([~?+-]?all)/,
        " include:amazonses.com $1",
      );
      const updated = await updateDNSRecord(existingSPF.id, {
        ...existingSPF,
        content: merged,
      });
      results.push(updated);
      warnings.push("Merged amazonses.com into existing SPF record");
    }
  } else {
    const spfRecord = await createDNSRecord({
      type: "TXT",
      name: returnPathRecordName,
      content: "v=spf1 include:amazonses.com ~all",
      ttl: 300,
    });
    results.push(spfRecord);
  }

  // DMARC TXT record — create starter guidance only when missing. Never
  // overwrite an existing customer DMARC policy.
  if (existingDmarcTXT.length > 0) {
    warnings.push(
      "DMARC record already exists — skipped to avoid overwriting your policy",
    );
  } else {
    const dmarcRecord = await createDNSRecord({
      type: "TXT",
      name: dmarcRecordName,
      content: DMARC_RECORD_VALUE,
      ttl: 300,
    });
    results.push(dmarcRecord);
  }

  // MX record — skip entirely if any MX records already exist to avoid
  // polluting setups like iCloud or Google Workspace custom domains
  if (existingMX.length > 0) {
    warnings.push(
      `Existing MX records found (${existingMX.map((r) => r.content).join(", ")}) — skipped adding SES feedback MX to avoid conflicts`,
    );
  } else {
    const mxRecord = await createDNSRecord({
      type: "MX",
      name: returnPathRecordName,
      content: "feedback-smtp.us-east-1.amazonses.com",
      ttl: 300,
      priority: 10,
    });
    results.push(mxRecord);
  }

  return { records: results, warnings };
}
