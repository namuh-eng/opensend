import {
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";

// ── BYO-DKIM keypair + envelope encryption ────────────────────────
//
// Opensend generates an RSA-2048 keypair per domain, hands the public
// key to SES via `DkimSigningAttributes` (origin EXTERNAL), and persists
// the private key encrypted at rest. Resend uses the same model, which
// lets us migrate domains across SES accounts without losing DKIM
// signing — the key lives in our DB, not in SES.
//
// Encryption uses AES-256-GCM keyed by a single env-supplied secret
// (`DKIM_ENCRYPTION_KEY`, 32 random bytes base64-encoded). We avoid
// KMS so the self-hosted deploy path stays pure-Postgres + .env.

const KEY_ENV = "DKIM_ENCRYPTION_KEY";
const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM standard

export type EncryptedBlob = {
  ct: string; // base64(ciphertext || authTag)
  iv: string; // base64(iv)
};

export type GeneratedDkimKey = {
  selector: string;
  publicKeyB64: string; // base64 DER SPKI — what SES wants
  publicKeyDnsValue: string; // raw base64 string for the TXT record
  privateKeyPemEncrypted: EncryptedBlob;
};

function loadMasterKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(
      `${KEY_ENV} is not set — generate one with \`openssl rand -base64 32\` and add it to .env`,
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `${KEY_ENV} must decode to ${KEY_LENGTH} bytes (got ${buf.length})`,
    );
  }
  return buf;
}

export function encryptSecret(plaintext: string): EncryptedBlob {
  const key = loadMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ct: Buffer.concat([ct, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(blob: EncryptedBlob): string {
  const key = loadMasterKey();
  const iv = Buffer.from(blob.iv, "base64");
  const combined = Buffer.from(blob.ct, "base64");
  const tag = combined.subarray(combined.length - 16);
  const ct = combined.subarray(0, combined.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}

export function buildDkimSelector(userId: string): string {
  // Selector must be DNS-label-safe and stable per domain. Resend uses
  // a short opaque token; we mirror that — opensend-<8 hex chars from
  // sha256(userId)>. Different users get different selectors so a
  // shared subdomain leak doesn't cross-link tenants.
  const hash = createHash("sha256").update(userId).digest("hex").slice(0, 8);
  return `opensend-${hash}`;
}

export function generateDkimKeypair(userId: string): GeneratedDkimKey {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const publicKeyB64 = publicKey.toString("base64");

  return {
    selector: buildDkimSelector(userId),
    publicKeyB64,
    publicKeyDnsValue: publicKeyB64,
    privateKeyPemEncrypted: encryptSecret(privateKey),
  };
}

export function buildDkimDnsRecord(params: {
  domain: string;
  selector: string;
  publicKeyB64: string;
}): { name: string; value: string } {
  return {
    name: `${params.selector}._domainkey.${params.domain}`,
    value: `v=DKIM1; k=rsa; p=${params.publicKeyB64}`,
  };
}
