import type { EditorBlock } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

function renderBlock(block: EditorBlock): string | null {
  const content = block.content ?? "";
  switch (block.type) {
    case "title":
      return `<h1>${escapeHtml(content)}</h1>`;
    case "subtitle":
      return `<h2>${escapeHtml(content)}</h2>`;
    case "heading":
      return `<h3>${escapeHtml(content)}</h3>`;
    case "text":
      return `<p>${escapeHtml(content)}</p>`;
    case "bullet_list":
      return `<ul><li>${escapeHtml(content)}</li></ul>`;
    case "numbered_list":
      return `<ol><li>${escapeHtml(content)}</li></ol>`;
    case "quote":
      return `<blockquote>${escapeHtml(content)}</blockquote>`;
    case "code_block":
      return `<pre><code>${escapeHtml(content)}</code></pre>`;
    case "image":
      return content
        ? `<img src="${escapeAttr(content)}" alt="" />`
        : "<!-- image: not configured -->";
    case "youtube":
      return content
        ? `<a href="${escapeAttr(content)}">${escapeHtml(content)}</a>`
        : null;
    case "twitter":
      return content
        ? `<a href="${escapeAttr(content)}">${escapeHtml(content)}</a>`
        : null;
    case "button":
      return `<a href="#" class="button">${escapeHtml(content || "Button")}</a>`;
    case "divider":
      return "<hr />";
    case "section":
      return "<section></section>";
    case "columns":
      return `<table role="presentation" width="100%"><tr><td></td><td></td></tr></table>`;
    case "social_links":
      return "<!-- social links placeholder -->";
    case "unsubscribe_footer":
      return `<p style="text-align:center;font-size:12px;"><a href="{{{OPENSEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p>`;
    case "html":
      return content;
    case "variable":
      return content;
    default:
      return content ? `<p>${escapeHtml(content)}</p>` : null;
  }
}

export function blocksToHtml(blocks: EditorBlock[]): string {
  return blocks
    .map(renderBlock)
    .filter((entry): entry is string => entry !== null)
    .join("\n");
}
