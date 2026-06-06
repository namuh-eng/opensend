export type DeliverabilityCheckStatus = "pass" | "warning" | "fail" | "info";

export type BimiReadinessStatus =
  | "not_configured"
  | "action_required"
  | "manual_review"
  | "ready";

export interface DeliverabilityCheck {
  key: string;
  label: string;
  status: DeliverabilityCheckStatus;
  message: string;
}

export interface DnsTxtRecordSet {
  name: string;
  values: string[];
  error?: string;
}

export interface BimiReadinessInput {
  domainName: string;
  selector?: string | null;
  dmarcTxt: DnsTxtRecordSet;
  bimiTxt: DnsTxtRecordSet;
  configuredLogoUrl?: string | null;
  configuredCertificateUrl?: string | null;
}

export interface BimiReadinessResult {
  status: BimiReadinessStatus;
  selector: string;
  bimiRecordName: string;
  dmarcRecordName: string;
  logoUrl: string | null;
  certificateUrl: string | null;
  checks: DeliverabilityCheck[];
  dns: {
    dmarc: DnsTxtRecordSet;
    bimi: DnsTxtRecordSet;
  };
}

function normalizeRecordValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseTagRecord(value: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of value.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    const key = rawKey?.trim().toLowerCase();
    const tagValue = rawValue.join("=").trim();
    if (key && tagValue) map.set(key, tagValue);
  }
  return map;
}

function firstRecordWithVersion(
  values: string[],
  version: string,
): string | null {
  const expected = version.toLowerCase();
  return (
    values
      .map(normalizeRecordValue)
      .find((value) => value.toLowerCase().startsWith(`v=${expected}`)) ?? null
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeSvgUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.pathname.toLowerCase().endsWith(".svg");
  } catch {
    return value.toLowerCase().includes(".svg");
  }
}

function getDmarcPolicy(dmarcRecord: string | null): string | null {
  if (!dmarcRecord) return null;
  return parseTagRecord(dmarcRecord).get("p")?.toLowerCase() ?? null;
}

function buildStatus(checks: DeliverabilityCheck[]): BimiReadinessStatus {
  const hasBimiRecord = checks.some(
    (check) => check.key === "bimi_dns" && check.status !== "fail",
  );
  if (!hasBimiRecord) return "not_configured";
  if (checks.some((check) => check.status === "fail")) return "action_required";
  if (checks.some((check) => check.status === "warning"))
    return "manual_review";
  return "ready";
}

export function evaluateBimiReadiness(
  input: BimiReadinessInput,
): BimiReadinessResult {
  const selector = input.selector?.trim() || "default";
  const bimiRecordName = `${selector}._bimi.${input.domainName}`;
  const dmarcRecordName = `_dmarc.${input.domainName}`;
  const dmarcRecord = firstRecordWithVersion(input.dmarcTxt.values, "DMARC1");
  const bimiRecord = firstRecordWithVersion(input.bimiTxt.values, "BIMI1");
  const dmarcPolicy = getDmarcPolicy(dmarcRecord);
  const bimiTags = bimiRecord
    ? parseTagRecord(bimiRecord)
    : new Map<string, string>();
  const dnsLogoUrl = bimiTags.get("l") ?? null;
  const dnsCertificateUrl = bimiTags.get("a") ?? null;
  const logoUrl = input.configuredLogoUrl ?? dnsLogoUrl;
  const certificateUrl = input.configuredCertificateUrl ?? dnsCertificateUrl;

  const checks: DeliverabilityCheck[] = [];

  if (!dmarcRecord) {
    checks.push({
      key: "dmarc_policy",
      label: "DMARC enforcement",
      status: "fail",
      message:
        "Publish a DMARC TXT record before BIMI can be considered ready.",
    });
  } else if (dmarcPolicy === "quarantine" || dmarcPolicy === "reject") {
    checks.push({
      key: "dmarc_policy",
      label: "DMARC enforcement",
      status: "pass",
      message:
        "DMARC is at an enforcement policy; confirm outbound SPF or DKIM aligns with the visible From domain.",
    });
  } else {
    checks.push({
      key: "dmarc_policy",
      label: "DMARC enforcement",
      status: "fail",
      message:
        "BIMI readiness requires DMARC p=quarantine or p=reject, not p=none or a missing policy.",
    });
  }

  if (!bimiRecord) {
    checks.push({
      key: "bimi_dns",
      label: "BIMI TXT record",
      status: "fail",
      message: `Publish a BIMI TXT record at ${bimiRecordName}.`,
    });
  } else if (!dnsLogoUrl) {
    checks.push({
      key: "bimi_dns",
      label: "BIMI TXT record",
      status: "fail",
      message: "The BIMI TXT record must include an l= logo URL.",
    });
  } else {
    checks.push({
      key: "bimi_dns",
      label: "BIMI TXT record",
      status: "pass",
      message: "A BIMI TXT record with a logo location is present.",
    });
  }

  if (!logoUrl) {
    checks.push({
      key: "bimi_logo",
      label: "Logo metadata",
      status: "fail",
      message:
        "Add an HTTPS SVG logo URL in the BIMI TXT record or OpenSend metadata.",
    });
  } else if (!isHttpsUrl(logoUrl)) {
    checks.push({
      key: "bimi_logo",
      label: "Logo metadata",
      status: "fail",
      message: "BIMI logo URLs must use HTTPS.",
    });
  } else if (!looksLikeSvgUrl(logoUrl)) {
    checks.push({
      key: "bimi_logo",
      label: "Logo metadata",
      status: "warning",
      message:
        "The logo URL is HTTPS, but OpenSend cannot confirm it is a BIMI-compatible SVG without fetching the asset.",
    });
  } else {
    checks.push({
      key: "bimi_logo",
      label: "Logo metadata",
      status: "pass",
      message: "The logo URL is HTTPS and appears to reference an SVG asset.",
    });
  }

  if (!certificateUrl) {
    checks.push({
      key: "bimi_certificate",
      label: "VMC/CMC certificate",
      status: "warning",
      message:
        "Some mailbox providers require or prefer a VMC/CMC certificate. Add certificate metadata when available.",
    });
  } else if (!isHttpsUrl(certificateUrl)) {
    checks.push({
      key: "bimi_certificate",
      label: "VMC/CMC certificate",
      status: "fail",
      message: "VMC/CMC certificate URLs must use HTTPS.",
    });
  } else {
    checks.push({
      key: "bimi_certificate",
      label: "VMC/CMC certificate",
      status: "pass",
      message:
        "Certificate metadata is present. OpenSend records the URL but does not validate certificate contents in v1.",
    });
  }

  return {
    status: buildStatus(checks),
    selector,
    bimiRecordName,
    dmarcRecordName,
    logoUrl,
    certificateUrl,
    checks,
    dns: {
      dmarc: input.dmarcTxt,
      bimi: input.bimiTxt,
    },
  };
}
