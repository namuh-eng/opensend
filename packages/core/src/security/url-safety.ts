import { promises as dns } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import net from "node:net";
import { Readable } from "node:stream";
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

type ResolvedOutboundTarget = {
  url: URL;
  host: string;
  address: string;
  family: 4 | 6;
};

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

function ipv4FromMappedIPv6(ip: string): string | null {
  const lower = ip.toLowerCase();
  if (!lower.startsWith("::ffff:")) return null;

  const mapped = lower.slice("::ffff:".length);
  if (net.isIPv4(mapped)) return mapped;

  const parts = mapped.split(":");
  if (parts.length !== 2) return null;

  const high = Number.parseInt(parts[0] ?? "", 16);
  const low = Number.parseInt(parts[1] ?? "", 16);
  if (
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return null;
  }

  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join(
    ".",
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  const mapped = ipv4FromMappedIPv6(lower);
  if (mapped) return isPrivateIPv4(mapped);
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

function hostnameBlocked(hostname: string): boolean {
  const h = normalizeUrlHostname(hostname);
  if (BLOCKED_HOSTNAMES_EXACT.has(h)) return true;
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (h.endsWith(suffix)) return true;
  }
  return false;
}

function normalizeUrlHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
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
  const host = normalizeUrlHostname(url.hostname);
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
    const mapped = ipv4FromMappedIPv6(lower);
    if (mapped) return isLoopbackOrLinkLocal(mapped);
    return false;
  }
  return false;
}

async function resolveAllAddresses(
  host: string,
  lookup?: AssertOptions["dnsLookup"],
): Promise<string[]> {
  const normalizedHost = normalizeUrlHostname(host);
  if (net.isIP(normalizedHost)) return [normalizedHost];
  if (lookup) {
    const records = await lookup(normalizedHost);
    return records.map((r) => r.address);
  }
  const records = await dns.lookup(normalizedHost, {
    all: true,
    verbatim: true,
  });
  return records.map((r) => r.address);
}

async function resolveSafeOutboundTarget(
  raw: string,
  options: AssertOptions,
  useCache: boolean,
): Promise<ResolvedOutboundTarget> {
  const cacheKey = `${options.context}::${raw}`;
  const cached = useCache ? verdictCache.get(cacheKey) : undefined;
  if (cached) {
    if (!cached.ok) throw new UnsafeOutboundUrlError(cached.reason);
    const url = new URL(raw);
    const host = normalizeUrlHostname(url.hostname);
    return {
      url,
      host,
      address: host,
      family: net.isIPv6(host) ? 6 : 4,
    };
  }

  const syncVerdict = parseAndValidateUrlSync(raw, options.context);
  if (!syncVerdict.ok) {
    verdictCache.set(cacheKey, syncVerdict);
    throw new UnsafeOutboundUrlError(syncVerdict.reason);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    const v: UrlSafetyVerdict = { ok: false, reason: "invalid_url" };
    verdictCache.set(cacheKey, v);
    throw new UnsafeOutboundUrlError(v.reason);
  }

  const host = normalizeUrlHostname(url.hostname);

  // Skip DNS rebind check only for preflight validation. Pinned fetches always
  // resolve and connect to the checked address.
  if (
    useCache &&
    !options.dnsLookup &&
    (envFlag("URL_SAFETY_SKIP_DNS") || process.env.VITEST === "true")
  ) {
    verdictCache.set(cacheKey, { ok: true });
    return {
      url,
      host,
      address: host,
      family: net.isIPv6(host) ? 6 : 4,
    };
  }

  let addresses: string[];
  try {
    addresses = await resolveAllAddresses(host, options.dnsLookup);
  } catch {
    const v: UrlSafetyVerdict = { ok: false, reason: "dns_resolution_failed" };
    if (useCache) verdictCache.set(cacheKey, v);
    throw new UnsafeOutboundUrlError(v.reason);
  }

  if (addresses.length === 0) {
    const v: UrlSafetyVerdict = { ok: false, reason: "no_dns_records" };
    if (useCache) verdictCache.set(cacheKey, v);
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
      if (useCache) verdictCache.set(cacheKey, v);
      throw new UnsafeOutboundUrlError(v.reason);
    }
  }

  if (useCache) verdictCache.set(cacheKey, { ok: true });
  const address = addresses[0];
  if (!address) {
    throw new UnsafeOutboundUrlError("no_dns_records");
  }

  return {
    url,
    host,
    address,
    family: net.isIPv6(address) ? 6 : 4,
  };
}

export async function assertSafeOutboundUrl(
  raw: string,
  options: AssertOptions,
): Promise<void> {
  await resolveSafeOutboundTarget(raw, options, true);
}

function headersToNodeHeaders(headers: HeadersInit | undefined): Headers {
  return new Headers(headers);
}

async function bodyToBuffer(body: BodyInit | null | undefined) {
  if (body === null || body === undefined) return undefined;
  return Buffer.from(await new Response(body).arrayBuffer());
}

function hasHeader(headers: Headers, name: string): boolean {
  for (const key of headers.keys()) {
    if (key.toLowerCase() === name.toLowerCase()) return true;
  }
  return false;
}

function toNodeHeaderRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export async function safeOutboundFetch(
  raw: string,
  init: RequestInit,
  options: AssertOptions,
): Promise<Response> {
  const target = await resolveSafeOutboundTarget(raw, options, false);
  const headers = headersToNodeHeaders(init.headers);
  headers.set("host", target.url.host);

  const body = await bodyToBuffer(init.body);
  if (body && !hasHeader(headers, "content-length")) {
    headers.set("content-length", String(body.byteLength));
  }

  return await new Promise<Response>((resolve, reject) => {
    const requestImpl =
      target.url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = requestImpl(
      {
        protocol: target.url.protocol,
        hostname: target.address,
        family: target.family,
        port:
          target.url.port || (target.url.protocol === "https:" ? "443" : "80"),
        path: `${target.url.pathname}${target.url.search}`,
        method: init.method ?? "GET",
        headers: toNodeHeaderRecord(headers),
        servername: net.isIP(target.host) ? undefined : target.host,
      },
      (message) => {
        if (
          init.redirect === "error" &&
          message.statusCode &&
          message.statusCode >= 300 &&
          message.statusCode < 400
        ) {
          message.destroy();
          reject(new TypeError("Redirect received for safe outbound fetch"));
          return;
        }

        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(message.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) responseHeaders.append(key, item);
          } else if (value !== undefined) {
            responseHeaders.set(key, value);
          }
        }

        resolve(
          new Response(Readable.toWeb(message) as ReadableStream, {
            status: message.statusCode ?? 599,
            statusText: message.statusMessage,
            headers: responseHeaders,
          }),
        );
      },
    );

    const abort = () => {
      request.destroy(
        new DOMException("The operation was aborted", "AbortError"),
      );
    };

    if (init.signal?.aborted) {
      abort();
      return;
    }

    init.signal?.addEventListener("abort", abort, { once: true });
    request.on("error", (error) => {
      init.signal?.removeEventListener("abort", abort);
      reject(error);
    });
    request.on("close", () => {
      init.signal?.removeEventListener("abort", abort);
    });
    if (body) request.write(body);
    request.end();
  });
}
