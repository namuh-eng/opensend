import { promises as dns } from "node:dns";
import net from "node:net";
import { LRUCache } from "lru-cache";

export class UnsafeOutboundUrlError extends Error {
  readonly code: string;
  readonly reason: string;
  constructor(reason: string, message?: string) {
    super(message ?? `Unsafe outbound URL: ${reason}`);
    this.name = "UnsafeOutboundUrlError";
    this.code = "UNSAFE_OUTBOUND_URL";
    this.reason = reason;
  }
}

export type UrlSafetyVerdict = { ok: true } | { ok: false; reason: string };

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".internal",
  ".local",
  ".localhost",
  ".cluster.local",
];

const BLOCKED_HOSTNAMES_EXACT = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice(7);
    if (net.isIPv4(mapped)) return isPrivateIPv4(mapped);
  }
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

function hostnameBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES_EXACT.has(h)) return true;
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (h.endsWith(suffix)) return true;
  }
  return false;
}

function envFlag(name: string): boolean {
  const v = process.env[name];
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true";
}

function dnsCacheTtlMs(): number {
  const raw = process.env.URL_SAFETY_DNS_CACHE_TTL_S;
  const n = raw ? Number.parseInt(raw, 10) : 60;
  return (Number.isFinite(n) && n > 0 ? n : 60) * 1000;
}

const verdictCache = new LRUCache<string, UrlSafetyVerdict>({
  max: 1000,
  ttl: dnsCacheTtlMs(),
});

export function _resetUrlSafetyCacheForTests(): void {
  verdictCache.clear();
}

export type AssertOptions = {
  /** "create" allows private targets when ALLOW_PRIVATE_WEBHOOK_URLS=true. "dispatch" never allows loopback/link-local. */
  context: "create" | "dispatch";
  /** Inject DNS lookup for testing. */
  dnsLookup?: (host: string) => Promise<{ address: string; family: number }[]>;
};

export function parseAndValidateUrlSync(
  raw: string,
  context: "create" | "dispatch",
): UrlSafetyVerdict {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "blocked_protocol" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials_in_url" };
  }
  const host = url.hostname;
  if (!host) return { ok: false, reason: "empty_host" };

  if (hostnameBlocked(host)) {
    if (context === "create" && envFlag("ALLOW_PRIVATE_WEBHOOK_URLS")) {
      // hostname blocklist applies regardless except for loopback escape — disallow at dispatch always
      return { ok: false, reason: "blocked_hostname" };
    }
    return { ok: false, reason: "blocked_hostname" };
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      if (
        context === "create" &&
        envFlag("ALLOW_PRIVATE_WEBHOOK_URLS") &&
        !isLoopbackOrLinkLocal(host)
      ) {
        return { ok: true };
      }
      return { ok: false, reason: "private_ip_literal" };
    }
  }
  return { ok: true };
}

function isLoopbackOrLinkLocal(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fe80")) return true;
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice(7);
      if (net.isIPv4(mapped)) return isLoopbackOrLinkLocal(mapped);
    }
    return false;
  }
  return false;
}

async function resolveAllAddresses(
  host: string,
  lookup?: AssertOptions["dnsLookup"],
): Promise<string[]> {
  if (net.isIP(host)) return [host];
  if (lookup) {
    const records = await lookup(host);
    return records.map((r) => r.address);
  }
  const records = await dns.lookup(host, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

export async function assertSafeOutboundUrl(
  raw: string,
  options: AssertOptions,
): Promise<void> {
  const cacheKey = `${options.context}::${raw}`;
  const cached = verdictCache.get(cacheKey);
  if (cached) {
    if (cached.ok) return;
    throw new UnsafeOutboundUrlError(cached.reason);
  }

  const syncVerdict = parseAndValidateUrlSync(raw, options.context);
  if (!syncVerdict.ok) {
    verdictCache.set(cacheKey, syncVerdict);
    throw new UnsafeOutboundUrlError(syncVerdict.reason);
  }

  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    const v: UrlSafetyVerdict = { ok: false, reason: "invalid_url" };
    verdictCache.set(cacheKey, v);
    throw new UnsafeOutboundUrlError(v.reason);
  }

  let addresses: string[];
  try {
    addresses = await resolveAllAddresses(host, options.dnsLookup);
  } catch {
    const v: UrlSafetyVerdict = { ok: false, reason: "dns_resolution_failed" };
    verdictCache.set(cacheKey, v);
    throw new UnsafeOutboundUrlError(v.reason);
  }

  if (addresses.length === 0) {
    const v: UrlSafetyVerdict = { ok: false, reason: "no_dns_records" };
    verdictCache.set(cacheKey, v);
    throw new UnsafeOutboundUrlError(v.reason);
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      if (
        options.context === "create" &&
        envFlag("ALLOW_PRIVATE_WEBHOOK_URLS") &&
        !isLoopbackOrLinkLocal(addr)
      ) {
        continue;
      }
      const v: UrlSafetyVerdict = { ok: false, reason: "private_ip_resolved" };
      verdictCache.set(cacheKey, v);
      throw new UnsafeOutboundUrlError(v.reason);
    }
  }

  verdictCache.set(cacheKey, { ok: true });
}
