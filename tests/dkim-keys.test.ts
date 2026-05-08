import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ORIGINAL_KEY = process.env.DKIM_ENCRYPTION_KEY;

describe("dkim-keys", () => {
  beforeEach(() => {
    process.env.DKIM_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) process.env.DKIM_ENCRYPTION_KEY = "";
    else process.env.DKIM_ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it("encryptSecret/decryptSecret round-trip", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/dkim-keys");
    const blob = encryptSecret("hunter2");
    expect(blob.ct).toBeTruthy();
    expect(blob.iv).toBeTruthy();
    expect(decryptSecret(blob)).toBe("hunter2");
  });

  it("encryptSecret produces fresh IVs", async () => {
    const { encryptSecret } = await import("@/lib/dkim-keys");
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("decryptSecret rejects tampered ciphertext", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/dkim-keys");
    const blob = encryptSecret("secret");
    const tampered = Buffer.from(blob.ct, "base64");
    tampered[0] = tampered[0] ^ 0xff;
    expect(() =>
      decryptSecret({ ct: tampered.toString("base64"), iv: blob.iv }),
    ).toThrow();
  });

  it("buildDkimSelector is deterministic per userId", async () => {
    const { buildDkimSelector } = await import("@/lib/dkim-keys");
    expect(buildDkimSelector("user-a")).toBe(buildDkimSelector("user-a"));
    expect(buildDkimSelector("user-a")).not.toBe(buildDkimSelector("user-b"));
    expect(buildDkimSelector("user-a")).toMatch(/^opensend-[0-9a-f]{8}$/);
  });

  it("generateDkimKeypair returns selector + base64 public key + encrypted private key", async () => {
    const { generateDkimKeypair, decryptSecret } = await import(
      "@/lib/dkim-keys"
    );
    const result = generateDkimKeypair("user-123");
    expect(result.selector).toMatch(/^opensend-/);
    expect(result.publicKeyB64.length).toBeGreaterThan(200);
    expect(result.publicKeyDnsValue).toBe(result.publicKeyB64);

    const pem = decryptSecret(result.privateKeyPemEncrypted);
    expect(pem).toContain("BEGIN PRIVATE KEY");
    expect(pem).toContain("END PRIVATE KEY");
  });

  it("buildDkimDnsRecord composes the TXT record", async () => {
    const { buildDkimDnsRecord } = await import("@/lib/dkim-keys");
    const record = buildDkimDnsRecord({
      domain: "example.com",
      selector: "opensend-abcd1234",
      publicKeyB64: "PUBKEY",
    });
    expect(record.name).toBe("opensend-abcd1234._domainkey.example.com");
    expect(record.value).toBe("v=DKIM1; k=rsa; p=PUBKEY");
  });

  it("throws when DKIM_ENCRYPTION_KEY is missing", async () => {
    process.env.DKIM_ENCRYPTION_KEY = "";
    const { encryptSecret } = await import("@/lib/dkim-keys");
    expect(() => encryptSecret("x")).toThrow(/DKIM_ENCRYPTION_KEY/);
  });

  it("throws when DKIM_ENCRYPTION_KEY is wrong length", async () => {
    process.env.DKIM_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
    const { encryptSecret } = await import("@/lib/dkim-keys");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });
});
