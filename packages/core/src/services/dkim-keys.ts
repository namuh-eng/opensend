import {
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";

const KEY_ENV_PRIMARY = "DKIM_ENCRYPTION_KEY";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

export type EncryptedBlob = {
  ct: string;
  iv: string;
  /**
   * Master-key version that encrypted this blob. Absent / 1 = legacy single-key
   * envelope. Higher versions look up DKIM_ENCRYPTION_KEY_V<N> and let the
   * operator rotate without breaking historical rows. New writes use
   * DKIM_KEY_VERSION (default 1).
   */
  kv?: number;
};

export type GeneratedDkimKey = {
  selector: string;
  publicKeyB64: string;
  publicKeyDnsValue: string;
  privateKeyPemEncrypted: EncryptedBlob;
};

function keyEnvForVersion(version: number): string {
  return version <= 1 ? KEY_ENV_PRIMARY : `${KEY_ENV_PRIMARY}_V${version}`;
}

function loadMasterKey(version: number): Buffer {
  const envName = keyEnvForVersion(version);
  const raw = process.env[envName];
  if (!raw) {
    throw new Error(
      `${envName} is not set — generate one with \`openssl rand -base64 32\` and add it to .env`,
    );
  }

  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `${envName} must decode to ${KEY_LENGTH} bytes (got ${buf.length})`,
    );
  }

  return buf;
}

function currentKeyVersion(): number {
  const raw = process.env.DKIM_KEY_VERSION;
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function encryptSecret(plaintext: string): EncryptedBlob {
  const version = currentKeyVersion();
  const key = loadMasterKey(version);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ct: Buffer.concat([ct, tag]).toString("base64"),
    iv: iv.toString("base64"),
    kv: version,
  };
}

export function decryptSecret(blob: EncryptedBlob): string {
  const version = blob.kv ?? 1;
  const key = loadMasterKey(version);
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
