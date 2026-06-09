import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class IntegrationSecretCryptoError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "IntegrationSecretCryptoError";
    this.code = code;
  }
}

function deriveKey(material: string): Buffer {
  if (/^[A-Fa-f0-9]{64}$/.test(material)) {
    return Buffer.from(material, "hex");
  }
  try {
    const decoded = Buffer.from(material, "base64");
    if (decoded.byteLength === KEY_BYTES) return decoded;
  } catch {
    // fall through to scrypt
  }
  return scryptSync(material, "opensend.integration-secret.v1", KEY_BYTES);
}

function keyMaterial(): string {
  const material =
    process.env.INTEGRATION_SECRET_ENCRYPTION_KEY ??
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!material) {
    throw new IntegrationSecretCryptoError(
      "MISSING_KEY",
      "INTEGRATION_SECRET_ENCRYPTION_KEY is not set",
    );
  }
  if (material.length < 16) {
    throw new IntegrationSecretCryptoError(
      "WEAK_KEY",
      "INTEGRATION_SECRET_ENCRYPTION_KEY must be at least 16 characters",
    );
  }
  return material;
}

function getKey(): Buffer {
  return deriveKey(keyMaterial());
}

export function encryptIntegrationSecret(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new IntegrationSecretCryptoError(
      "EMPTY_PLAINTEXT",
      "Cannot encrypt empty integration secret",
    );
  }

  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${iv.toString("base64url")}.${ct.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptIntegrationSecret(payload: string): string {
  const parts = payload.split(".");
  const [version, ivB64, ctB64, tagB64] = parts as [
    string?,
    string?,
    string?,
    string?,
  ];
  if (
    parts.length !== 4 ||
    version !== VERSION ||
    !ivB64 ||
    !ctB64 ||
    !tagB64
  ) {
    throw new IntegrationSecretCryptoError(
      "BAD_FORMAT",
      "Unsupported integration secret ciphertext format",
    );
  }

  const key = getKey();
  const iv = Buffer.from(ivB64, "base64url");
  const ct = Buffer.from(ctB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  if (iv.byteLength !== IV_BYTES || tag.byteLength !== TAG_BYTES) {
    throw new IntegrationSecretCryptoError(
      "BAD_FORMAT",
      "Invalid IV or tag length",
    );
  }

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

export function isEncryptedIntegrationSecret(payload: string): boolean {
  return typeof payload === "string" && payload.startsWith(`${VERSION}.`);
}
