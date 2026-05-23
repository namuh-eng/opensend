import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { getUnsubscribePageSettings } from "@opensend/core";
import { eq } from "drizzle-orm";

const BRAND_COLOR_REGEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

const DEFAULT_SETTINGS = {
  logoUrl: null as string | null,
  brandColor: "#10b981",
  headline: "Unsubscribed successfully",
  message:
    "You have been removed from this mailing list. You will no longer receive marketing emails from this sender.",
  footerText: "Powered by OpenSend",
};

/** Escape characters that are dangerous in HTML text nodes and attributes. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type PageSettings = {
  logoUrl: string | null;
  brandColor: string;
  headline: string;
  message: string;
  footerText: string;
};

function pageHtml(
  status: "success" | "error",
  errorMessage: string,
  s: PageSettings,
): string {
  // Re-validate brandColor at render time (defense in depth)
  const safeColor = BRAND_COLOR_REGEX.test(s.brandColor)
    ? s.brandColor
    : status === "success"
      ? DEFAULT_SETTINGS.brandColor
      : "#ef4444";

  // Re-validate logoUrl at render time
  let logoTag = "";
  if (s.logoUrl) {
    let logoValid = false;
    try {
      const parsed = new URL(s.logoUrl);
      logoValid = parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      logoValid = false;
    }
    if (logoValid) {
      // HTML-attribute-escape the URL before interpolation
      logoTag = `<img src="${escapeHtml(s.logoUrl)}" alt="Logo" style="max-height:48px;max-width:180px;margin:0 auto 1rem;display:block;" />`;
    }
  }

  const icon = status === "success" ? "✓" : "!";
  const title =
    status === "success" ? escapeHtml(s.headline) : "Something went wrong";
  const body =
    status === "success" ? escapeHtml(s.message) : escapeHtml(errorMessage);
  const footer = escapeHtml(s.footerText);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · OpenSend</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a0a0a; color: #fff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(28rem, calc(100vw - 3rem)); background: #1a1a1a; border: 1px solid rgba(255,255,255,.08); border-radius: 1rem; padding: 2rem; text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,.45); }
    .icon { width: 3rem; height: 3rem; border-radius: 999px; margin: 0 auto 1rem; display: grid; place-items: center; color: ${safeColor}; border: 2px solid ${safeColor}; font-weight: 700; }
    h1 { margin: 0 0 1rem; font-size: 1.25rem; }
    p { color: #a1a1aa; line-height: 1.5; margin: 0; font-size: .875rem; }
    footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,.04); color: #52525b; font-size: .625rem; text-transform: uppercase; letter-spacing: .16em; font-weight: 600; }
  </style>
</head>
<body>
  <main data-testid="unsubscribe-${status}">
    ${logoTag}
    <div class="icon" aria-hidden="true">${icon}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <footer>${footer}</footer>
  </main>
</body>
</html>`;
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function markUnsubscribed(contactId: string, token: string | null) {
  if (!verifyUnsubscribeToken(contactId, token)) {
    return { ok: false as const, status: 404, userId: null };
  }

  const [updated] = await db
    .update(contacts)
    .set({ unsubscribed: true })
    .where(eq(contacts.id, contactId))
    .returning({ id: contacts.id, userId: contacts.userId });

  if (!updated) return { ok: false as const, status: 404, userId: null };
  return { ok: true as const, userId: updated.userId };
}

async function loadSettings(userId: string | null): Promise<PageSettings> {
  if (!userId) return { ...DEFAULT_SETTINGS };
  try {
    return await getUnsubscribePageSettings(userId);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
): Promise<Response> {
  const { contactId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  const result = await markUnsubscribed(contactId, token);

  if (!result.ok) {
    return htmlResponse(
      pageHtml(
        "error",
        "We couldn't process your unsubscribe request. Please use the latest link from your email or contact the sender.",
        { ...DEFAULT_SETTINGS },
      ),
      result.status,
    );
  }

  const settings = await loadSettings(result.userId);

  return htmlResponse(pageHtml("success", "", settings));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
): Promise<Response> {
  const { contactId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  const result = await markUnsubscribed(contactId, token);
  return new Response(null, {
    status: result.ok ? 202 : result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
