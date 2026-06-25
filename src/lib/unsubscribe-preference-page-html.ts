import {
  OPENSEND_ATTRIBUTION_TEXT,
  OPENSEND_HOME_URL,
  isOpenSendAttribution,
} from "@/lib/opensend-attribution";
import type { UnsubscribePreferenceModel } from "@/lib/unsubscribe-preferences";

const BRAND_COLOR_REGEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const DEFAULT_BRAND_COLOR = "#10b981";

type PageStatus = "ready" | "saved" | "global_unsubscribed" | "error";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function responseHeaders(contentType: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; img-src https: http:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  };
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: responseHeaders("text/html; charset=utf-8"),
  });
}

export function emptyResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function safeLogoTag(logoUrl: string | null): string {
  if (!logoUrl) return "";

  try {
    const parsed = new URL(logoUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
  } catch (error) {
    if (error instanceof TypeError) return "";
    throw error;
  }

  return `<img src="${escapeHtml(logoUrl)}" alt="" width="180" height="48" style="max-height:48px;max-width:180px;object-fit:contain;margin:0 auto 1rem;display:block;" />`;
}

function topicRows(model: UnsubscribePreferenceModel): string {
  if (model.topics.length === 0) {
    return `<p class="empty">No public topic preferences are available for this sender. You can still unsubscribe from all marketing emails.</p>`;
  }

  return model.topics
    .map((topic) => {
      const checked = topic.subscribed ? " checked" : "";
      const focused = topic.id === model.focusedTopicId ? " focused" : "";
      const description = topic.description
        ? `<span class="topic-description">${escapeHtml(topic.description)}</span>`
        : "";
      return `<label class="topic${focused}">
        <input type="checkbox" name="topics" value="${escapeHtml(topic.id)}"${checked} />
        <span>
          <span class="topic-name">${escapeHtml(topic.name)}</span>
          ${description}
          <span class="topic-meta">${topic.visibility}</span>
        </span>
      </label>`;
    })
    .join("");
}

function visibleTitle(
  status: PageStatus,
  model: UnsubscribePreferenceModel | null,
) {
  const fallback =
    status === "error"
      ? "Something went wrong"
      : status === "global_unsubscribed"
        ? "Unsubscribed from all emails"
        : "Subscription preferences";

  const storedHeadline = model?.settings.headline;
  return (status === "ready" || status === "saved") &&
    storedHeadline &&
    storedHeadline !== "Unsubscribed successfully"
    ? storedHeadline
    : fallback;
}

function dataTestId(status: PageStatus): string {
  switch (status) {
    case "error":
      return "unsubscribe-error";
    case "saved":
      return "unsubscribe-preferences-saved";
    case "global_unsubscribed":
      return "unsubscribe-success";
    case "ready":
      return "unsubscribe-preferences";
    default:
      status satisfies never;
      return "unsubscribe-error";
  }
}

function actionButtons(model: UnsubscribePreferenceModel): string {
  if (model.topics.length === 0) {
    return `<button class="primary" type="submit" name="action" value="unsubscribe_all">Unsubscribe from all</button>`;
  }

  if (model.focusedTopicId) {
    return `<button class="primary" type="submit" name="action" value="save_preferences">Update preferences</button>
              <button type="submit" name="action" value="unsubscribe_all">Unsubscribe from all</button>`;
  }

  return `<button class="primary" type="submit" name="action" value="unsubscribe_all">Unsubscribe from all</button>
              <button type="submit" name="action" value="save_preferences">Update preferences</button>`;
}

function footerMarkup(footerText: string): string {
  if (isOpenSendAttribution(footerText)) {
    return `<a href="${OPENSEND_HOME_URL}" target="_blank" rel="noopener noreferrer">${OPENSEND_ATTRIBUTION_TEXT}</a>`;
  }

  return escapeHtml(footerText);
}

export function preferencePageHtml(
  status: PageStatus,
  model: UnsubscribePreferenceModel | null,
  message: string,
): string {
  const safeColor =
    model && BRAND_COLOR_REGEX.test(model.settings.brandColor)
      ? model.settings.brandColor
      : DEFAULT_BRAND_COLOR;
  const title = visibleTitle(status, model);
  const settingsMessage =
    model?.settings.message ??
    "Manage which updates you receive from this sender.";
  const footerText = model?.settings.footerText ?? OPENSEND_ATTRIBUTION_TEXT;
  const topicMarkup = model ? topicRows(model) : "";
  const alert =
    message && status !== "error"
      ? `<p class="alert">${escapeHtml(message)}</p>`
      : "";
  const body =
    status === "error"
      ? `<p class="copy">${escapeHtml(message)}</p>`
      : `<p class="copy">${escapeHtml(settingsMessage)}</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · OpenSend</title>
  <style>
    :root { color-scheme: dark; --accent: ${safeColor}; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #0a0a0a; color: #f8fafc; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(34rem, calc(100vw - 2rem)); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 2rem; background: #111111; }
    h1 { margin: 0 0 .75rem; font-size: 1.375rem; line-height: 1.2; letter-spacing: 0; }
    .copy, .empty { color: #a1a1aa; line-height: 1.55; margin: 0 0 1.5rem; font-size: .925rem; }
    .alert { border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent); background: color-mix(in srgb, var(--accent) 12%, transparent); color: #f8fafc; border-radius: 8px; padding: .75rem .875rem; margin: 0 0 1rem; font-size: .875rem; }
    form { margin: 0; }
    .topics { display: grid; gap: .75rem; margin: 0 0 1.25rem; }
    .topic { display: grid; grid-template-columns: 1rem 1fr; gap: .75rem; align-items: start; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: .875rem; background: rgba(255,255,255,.025); }
    .topic.focused { border-color: color-mix(in srgb, var(--accent) 70%, transparent); }
    input[type="checkbox"] { width: 1rem; height: 1rem; margin: .125rem 0 0; accent-color: var(--accent); }
    .topic-name { display: block; font-size: .9375rem; font-weight: 650; }
    .topic-description { display: block; color: #a1a1aa; font-size: .8125rem; margin-top: .25rem; line-height: 1.45; }
    .topic-meta { display: inline-block; margin-top: .5rem; color: #71717a; font-size: .6875rem; text-transform: uppercase; letter-spacing: .08em; }
    .actions { display: flex; flex-wrap: wrap; gap: .75rem; }
    button { min-height: 2.5rem; border-radius: 8px; border: 1px solid rgba(255,255,255,.14); padding: .625rem 1rem; color: #f8fafc; background: transparent; font: inherit; font-size: .875rem; font-weight: 650; cursor: pointer; }
    button.primary { border-color: var(--accent); background: var(--accent); color: #020617; }
    button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,.08); color: #71717a; font-size: .75rem; }
    footer a { color: inherit; text-decoration: none; }
    footer a:hover { color: #a1a1aa; }
  </style>
</head>
<body>
  <main data-testid="${dataTestId(status)}">
    ${safeLogoTag(model?.settings.logoUrl ?? null)}
    <h1>${escapeHtml(title)}</h1>
    ${body}
    ${alert}
    ${
      model && status !== "error" && status !== "global_unsubscribed"
        ? `<form method="post">
            <div class="topics">${topicMarkup}</div>
            <div class="actions">
              ${actionButtons(model)}
            </div>
          </form>`
        : ""
    }
    <footer>${footerMarkup(footerText)}</footer>
  </main>
</body>
</html>`;
}

export function invalidPreferenceHtml(
  status: number,
  message: string,
): Response {
  return htmlResponse(preferencePageHtml("error", null, message), status);
}
