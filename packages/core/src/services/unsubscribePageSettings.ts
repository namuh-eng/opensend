import { unsubscribePageSettingsRepo } from "../db/repositories/unsubscribePageSettingsRepo";

const BRAND_COLOR_REGEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

export class UnsubscribePageSettingsValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "UnsubscribePageSettingsValidationError";
  }
}

export type UnsubscribePageSettingsData = {
  logoUrl: string | null;
  brandColor: string;
  headline: string;
  message: string;
  footerText: string;
};

const DEFAULTS: UnsubscribePageSettingsData = {
  logoUrl: null,
  brandColor: "#10b981",
  headline: "Unsubscribed successfully",
  message:
    "You have been removed from this mailing list. You will no longer receive marketing emails from this sender.",
  footerText: "Powered by OpenSend",
};

export async function getUnsubscribePageSettings(
  userId: string,
): Promise<UnsubscribePageSettingsData> {
  const row = await unsubscribePageSettingsRepo.getByUserId(userId);
  if (!row) return { ...DEFAULTS };
  return {
    logoUrl: row.logoUrl ?? null,
    brandColor: row.brandColor,
    headline: row.headline,
    message: row.message,
    footerText: row.footerText,
  };
}

export type UnsubscribePageSettingsInput = {
  logoUrl?: string | null;
  brandColor?: string;
  headline?: string;
  message?: string;
  footerText?: string;
};

export async function updateUnsubscribePageSettings(
  userId: string,
  input: UnsubscribePageSettingsInput,
): Promise<UnsubscribePageSettingsData> {
  const validated = validateInput(input);
  const row = await unsubscribePageSettingsRepo.upsert(userId, validated);
  return {
    logoUrl: row.logoUrl ?? null,
    brandColor: row.brandColor,
    headline: row.headline,
    message: row.message,
    footerText: row.footerText,
  };
}

function validateInput(input: UnsubscribePageSettingsInput): {
  logoUrl?: string | null;
  brandColor?: string;
  headline?: string;
  message?: string;
  footerText?: string;
} {
  const out: {
    logoUrl?: string | null;
    brandColor?: string;
    headline?: string;
    message?: string;
    footerText?: string;
  } = {};

  if ("logoUrl" in input) {
    if (input.logoUrl === null || input.logoUrl === undefined) {
      out.logoUrl = null;
    } else {
      const trimmed = String(input.logoUrl).trim();
      if (trimmed === "") {
        out.logoUrl = null;
      } else {
        // Validate as http/https URL
        let parsed: URL;
        try {
          parsed = new URL(trimmed);
        } catch {
          throw new UnsubscribePageSettingsValidationError(
            "logoUrl must be a valid http or https URL",
          );
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new UnsubscribePageSettingsValidationError(
            "logoUrl must use the http or https protocol",
          );
        }
        if (trimmed.length > 2048) {
          throw new UnsubscribePageSettingsValidationError(
            "logoUrl must be 2048 characters or fewer",
          );
        }
        out.logoUrl = trimmed;
      }
    }
  }

  if ("brandColor" in input && input.brandColor !== undefined) {
    const trimmed = String(input.brandColor).trim();
    if (!BRAND_COLOR_REGEX.test(trimmed)) {
      throw new UnsubscribePageSettingsValidationError(
        "brandColor must be a valid hex color (#rrggbb or #rrggbbaa)",
      );
    }
    out.brandColor = trimmed;
  }

  if ("headline" in input && input.headline !== undefined) {
    const trimmed = String(input.headline).trim();
    if (trimmed.length === 0) {
      throw new UnsubscribePageSettingsValidationError(
        "headline must not be empty",
      );
    }
    if (trimmed.length > 200) {
      throw new UnsubscribePageSettingsValidationError(
        "headline must be 200 characters or fewer",
      );
    }
    out.headline = trimmed;
  }

  if ("message" in input && input.message !== undefined) {
    const trimmed = String(input.message).trim();
    if (trimmed.length === 0) {
      throw new UnsubscribePageSettingsValidationError(
        "message must not be empty",
      );
    }
    if (trimmed.length > 1000) {
      throw new UnsubscribePageSettingsValidationError(
        "message must be 1000 characters or fewer",
      );
    }
    out.message = trimmed;
  }

  if ("footerText" in input && input.footerText !== undefined) {
    const trimmed = String(input.footerText).trim();
    if (trimmed.length === 0) {
      throw new UnsubscribePageSettingsValidationError(
        "footerText must not be empty",
      );
    }
    if (trimmed.length > 200) {
      throw new UnsubscribePageSettingsValidationError(
        "footerText must be 200 characters or fewer",
      );
    }
    out.footerText = trimmed;
  }

  return out;
}
