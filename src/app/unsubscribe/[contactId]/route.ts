import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import {
  emptyResponse,
  htmlResponse,
  invalidPreferenceHtml,
  preferencePageHtml,
} from "@/lib/unsubscribe-preference-page-html";
import {
  type UnsubscribeContext,
  loadUnsubscribePreferences,
  saveTopicPreferences,
  unsubscribeAll,
} from "@/lib/unsubscribe-preferences";

type PostIntent =
  | { readonly kind: "one_click" }
  | {
      readonly kind: "save_preferences";
      readonly selectedTopicIds: Set<string>;
    }
  | { readonly kind: "unsubscribe_all" }
  | { readonly kind: "invalid"; readonly message: string };

function contextFromRequest(request: Request): UnsubscribeContext {
  const searchParams = new URL(request.url).searchParams;
  return {
    topicId: searchParams.get("topic_id") ?? searchParams.get("topicId"),
    broadcastId:
      searchParams.get("broadcast_id") ?? searchParams.get("broadcastId"),
  };
}

function parseFormIntent(params: URLSearchParams): PostIntent {
  const entries = [...params.entries()];
  const isOneClick = params.get("List-Unsubscribe") === "One-Click";
  const action = params.get("action");

  if (isOneClick) {
    return entries.length === 1
      ? { kind: "one_click" }
      : {
          kind: "invalid",
          message: "One-click unsubscribe cannot be mixed with other actions.",
        };
  }

  if (action === "save_preferences") {
    return {
      kind: "save_preferences",
      selectedTopicIds: new Set(params.getAll("topics")),
    };
  }

  if (action === "unsubscribe_all") return { kind: "unsubscribe_all" };

  return {
    kind: "invalid",
    message: "Unsupported unsubscribe action.",
  };
}

async function parsePostIntent(request: Request): Promise<PostIntent> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded")) {
    return {
      kind: "invalid",
      message: "Unsupported unsubscribe content type.",
    };
  }

  return parseFormIntent(new URLSearchParams(await request.text()));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
): Promise<Response> {
  const { contactId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  if (!verifyUnsubscribeToken(contactId, token)) {
    return invalidPreferenceHtml(
      404,
      "We couldn't process your unsubscribe request. Please use the latest link from your email or contact the sender.",
    );
  }

  const result = await loadUnsubscribePreferences(
    contactId,
    contextFromRequest(request),
  );
  if (!result.ok) return invalidPreferenceHtml(result.status, result.message);

  return htmlResponse(preferencePageHtml("ready", result.model, ""));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
): Promise<Response> {
  const { contactId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  if (!verifyUnsubscribeToken(contactId, token)) return emptyResponse(404);

  const intent = await parsePostIntent(request);
  switch (intent.kind) {
    case "one_click": {
      const updated = await unsubscribeAll(contactId);
      return emptyResponse(updated ? 202 : 404);
    }
    case "unsubscribe_all": {
      const updated = await unsubscribeAll(contactId);
      if (!updated)
        return invalidPreferenceHtml(404, "We couldn't find this contact.");
      const result = await loadUnsubscribePreferences(
        contactId,
        contextFromRequest(request),
      );
      return htmlResponse(
        preferencePageHtml(
          "global_unsubscribed",
          result.ok ? result.model : null,
          "You have been removed from all marketing emails from this sender.",
        ),
      );
    }
    case "save_preferences": {
      const result = await saveTopicPreferences(
        contactId,
        contextFromRequest(request),
        intent.selectedTopicIds,
      );
      if (!result.ok)
        return invalidPreferenceHtml(result.status, result.message);
      return htmlResponse(
        preferencePageHtml(
          "saved",
          result.model,
          "Your preferences have been saved.",
        ),
      );
    }
    case "invalid":
      return invalidPreferenceHtml(400, intent.message);
    default:
      intent satisfies never;
      return invalidPreferenceHtml(400, "Unsupported unsubscribe action.");
  }
}
