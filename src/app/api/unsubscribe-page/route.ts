import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import {
  UnsubscribePageSettingsValidationError,
  createAudienceMetadataService,
  getUnsubscribePageSettings,
  updateUnsubscribePageSettings,
} from "@opensend/core";
import { NextResponse } from "next/server";

async function resolveUserId(req: Request): Promise<string | Response> {
  const auth = await authorizeDashboardOrApiKey(
    req.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();

  if ("dashboard" in auth) {
    const session = await getServerSession();
    if (!session?.user?.id) return unauthorizedResponse();
    return session.user.id;
  }

  if ("userId" in auth && auth.userId) {
    return auth.userId;
  }

  return unauthorizedResponse();
}

export async function GET(req: Request) {
  const userIdOrResponse = await resolveUserId(req);
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  try {
    const [settings, topics] = await Promise.all([
      getUnsubscribePageSettings(userId),
      createAudienceMetadataService().listTopics({ userId, limit: 100 }),
    ]);
    return NextResponse.json({
      object: "unsubscribe_page_settings",
      logo_url: settings.logoUrl,
      brand_color: settings.brandColor,
      headline: settings.headline,
      message: settings.message,
      footer_text: settings.footerText,
      topics: topics.data,
    });
  } catch (error) {
    console.error("Failed to get unsubscribe page settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const userIdOrResponse = await resolveUserId(req);
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 },
    );
  }

  const raw = body as Record<string, unknown>;

  const input: {
    logoUrl?: string | null;
    brandColor?: string;
    headline?: string;
    message?: string;
    footerText?: string;
  } = {};

  if ("logo_url" in raw) {
    input.logoUrl =
      raw.logo_url === null || raw.logo_url === undefined
        ? null
        : String(raw.logo_url);
  }
  if ("brand_color" in raw && raw.brand_color !== undefined) {
    input.brandColor = String(raw.brand_color);
  }
  if ("headline" in raw && raw.headline !== undefined) {
    input.headline = String(raw.headline);
  }
  if ("message" in raw && raw.message !== undefined) {
    input.message = String(raw.message);
  }
  if ("footer_text" in raw && raw.footer_text !== undefined) {
    input.footerText = String(raw.footer_text);
  }

  try {
    const settings = await updateUnsubscribePageSettings(userId, input);
    return NextResponse.json({
      object: "unsubscribe_page_settings",
      logo_url: settings.logoUrl,
      brand_color: settings.brandColor,
      headline: settings.headline,
      message: settings.message,
      footer_text: settings.footerText,
    });
  } catch (error) {
    if (error instanceof UnsubscribePageSettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to update unsubscribe page settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
