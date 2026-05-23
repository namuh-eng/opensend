---
date: 2026-05-21
issue: docs-start-layout
type: decision
promoted_to: null
---

# Docs shell layout and navigation

The `/docs` overview page has no markdown-derived headings, so rendering the standard docs right rail produces an empty "On this page" card and narrows the hero enough for the headline/code split to look cramped on wide desktop screenshots. Use the docs shell right rail for guide pages with headings, but opt the overview page out and keep the OpenAPI/LLM links in the overview content itself.

Many short generated docs pages also have no `##`/`###` headings. On those pages, do not render a placeholder "On this page" card; keep only useful tools/contracts in the right rail.

The full docs sidebar is hidden below `xl`, so mobile/tablet users need an in-page docs navigator. Reuse the same docs nav data in a collapsed mobile `<details>` control and style the docs scrollbar inside the dark landing shell so Linux/Chromium screenshots do not show a bright native scrollbar.

## SDK snippet copy-paste checks

Docs examples should be treated as runnable snippets. A corpus scan found `public/docs/sdks.md` referenced `os.environ` without importing `os`, so keep a docs-content regression that every Python fence using `os.environ` also includes `import os`.

## Header and metadata polish

The docs header should route "SDKs" to the SDK overview (`/docs/sdks`), not the Node.js send example. The docs overview should also define its own `OpenSend Docs` metadata title instead of inheriting the generic root title.

## Markdown link normalization

Rendered markdown pages need the current docs `relPath` so inline links can resolve `./foo.md` and `../foo.md` to styled `/docs/foo` routes instead of leaking raw relative `.md` paths into the human docs shell. Keep external OpenSend-owned links explicit, and do not normalize paths that escape `public/docs`.

## Inline docs link styling

The landing shell has a broad `.landing-root a { color: inherit; text-decoration: none; }` reset, so Tailwind `text-accent underline` classes on inline docs links can be silently neutralized by cascade order. Use a dedicated `.docs-link` class after the reset for markdown/body links that must look clickable.

The reset itself must stay low-specificity (`:where(.landing-root a)`) so button, active-nav, and utility colors such as `text-accent-ink` can override it. A higher-specificity `.landing-root a` made primary CTA text inherit white on a lime background.

## Sidebar information architecture

The root docs pages need an explicit `DOC_ORDER`; otherwise the Start here section interleaves quickstarts with AI/skill/operator pages alphabetically after the first few pinned docs. Keep SDKs, examples, and framework quickstarts together before integrations, CLI, MCP, and agent-specific guides.

## Concise page fallback

Many generated guide and dashboard docs are intentionally short title-plus-summary pages. The styled docs shell should not leave those pages visually empty after the duplicated summary is skipped; render a truthful "Continue from here" block from the same docs section so every short page still has useful next steps without inventing unsupported product claims.

The LLM docs index should use the same information architecture as the human docs nav. Keep SDKs/examples/quickstarts ahead of agent/operator pages and place webhook overview pages before individual event payload pages.

Related-doc cards should use a window around the current page, not the first N items in the section. API and Start here sections are large enough that first-N cards can be unrelated to a concise endpoint/operator page despite the UI saying "neighboring guides".
